// Rate Limiting as a Durable Object.  Exposed as DEBOUNCE env binding for
// workers; 5 seconds per action is hard-coded but could be parameterized, and
// could be expanded to a reservoir of allowed actions over a sliding window.

import { DurableObject, DurableObjectState } from "cloudflare:workers";
import type { Env } from "./env"

// This is utilized in ChatRoom, to apply a per-IP-address rate limit. These
// limits are global, i.e. they apply across all chat rooms, so if a user spams
// one chat room, they will find themselves rate limited in all other chat rooms
// and game sessions simultaneously.
export class RateLimiter {
  private nextAllowedTime; // number

  constructor(/* state, env */) {
    // Timestamp at which this IP will next be allowed to send a message. Start in the distant
    // past, i.e. the IP can send a message now.
    this.nextAllowedTime = 0;
  }

  // Our protocol is: POST when the IP performs an action, or GET to simply read the current limit.
  // Either way, the result is the number of seconds to wait before allowing the IP to perform its
  // next action.
  async fetch(request) {
    return await handleErrors(request, async () => {
      let now = Date.now() / 1000;

      this.nextAllowedTime = Math.max(now, this.nextAllowedTime);

      if (request.method == "POST") {
        // POST request means the user performed an action.
        // We allow one action per 5 seconds.
        this.nextAllowedTime += 5;
      }

      // Return the number of seconds that the client needs to wait.
      //
      // We provide a "grace" period of 20 seconds, meaning that the client can make 4-5 requests
      // in a quick burst before they start being limited.
      let cooldownTime = Math.max(0, this.nextAllowedTime - now - 20);
      return new Response(cooldownTime);
    })
  }
}

// RateLimiterClient implements rate limiting logic on the caller's side.
//
// [openLimiter()] returns a new Durable Object stub for the RateLimiter object
//   that manages the limit. This may be called multiple times as needed to
//   reconnect, if the connection is lost.
// [reportError(err)] is called when something goes wrong and the rate limiter
//   is broken. It should probably disconnect the client, so that they can
//   reconnect and start over.
export class RateLimitedClient {
  /* private */ openLimiter; // function() RateLimiter
  /* private */ reportError; // function(err)
  /* private */ limiter; // RateLimiter
  /* private */ cooling; // boolean

  // The constructor takes two functions:
  constructor(openLimiter, reportError) {
    this.openLimiter = openLimiter;
    this.reportError = reportError;

    this.limiter = this.openLimiter();
    this.cooling = false;
  }

  // Call checkLimit() when a message is received to decide if it should be blocked due to the
  // rate limit. Returns `true` if the message should be accepted, `false` to reject.
  checkLimit() {
    if (this.cooling) {
      return false;
    }
    this.cooling = true;
    this.callLimiter();
    return true;
  }

  // callLimiter() is an internal method which talks to the rate limiter.
  async callLimiter() {
    try {
      let response;
      try {
        // Currently, fetch() needs a valid URL even though it's not actually going to the
        // internet. We may loosen this in the future to accept an arbitrary string. But for now,
        // we have to provide a dummy URL that will be ignored at the other end anyway.
        response = await this.limiter.fetch("https://dummy-url", {method: "POST"});
      } catch (err) {
        // `fetch()` threw an exception. This is probably because the limiter has been
        // disconnected. Stubs implement E-order semantics, meaning that calls to the same stub
        // are delivered to the remote object in order, until the stub becomes disconnected, after
        // which point all further calls fail. This guarantee makes a lot of complex interaction
        // patterns easier, but it means we must be prepared for the occasional disconnect, as
        // networks are inherently unreliable.
        //
        // Anyway, get a new limiter and try again. If it fails again, something else is probably
        // wrong.
        this.limiter = this.getLimiterStub();
        response = await this.limiter.fetch("https://dummy-url", {method: "POST"});
      }

      // The response indicates how long we want to pause before accepting more requests.
      let cooldown = +(await response.text());
      await new Promise(resolve => setTimeout(resolve, cooldown * 1000));

      // Done cooling down.
      this.cooling = false;
    } catch (err) {
      this.reportError(err);
    }
  }
}

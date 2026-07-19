// Copyright (c) 2024 Kevin Damm
// All rights reserved.
// BSD-3-Clause License
//
// Redistribution and use in source and binary forms, with or without
// modification, are permitted provided that the following conditions are met:
//
// 1. Redistributions of source code must retain the above copyright notice,
//    this list of conditions and the following disclaimer.
// 2. Redistributions in binary form must reproduce the above copyright
//    notice, this list of conditions and the following disclaimer in the
//    documentation and/or other materials provided with the distribution.
// 3. Neither the name of mosquitto nor the names of its
//    contributors may be used to endorse or promote products derived from
//    this software without specific prior written permission.
//
// THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
// AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
// IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE
// ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT OWNER OR CONTRIBUTORS BE
// LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR
// CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF
// SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS
// INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN
// CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE)
// ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE
// POSSIBILITY OF SUCH DAMAGE.

import { DurableObject } from "cloudflare:workers"
import { RateLimitedClient } from "./ratelimiter"

import type { Env } from "./env"

// Chat rooms as a Durable Object class, coordinates all user interactions with
// a specific chat room.  The room broadcasts messages from each participant to
// all of the others via a Session object for each member in the chat.
export class ChatRoom extends DurableObject<Env> {
  private state: DurableObjectState;
  private storage: DurableObjectStorage;

  constructor(state: DurableObjectState, env: Env) {
    super(state, env)
    this.state = state;
    this.storage = state.storage;

    this.state.getWebSockets().forEach((socket: ) => {
      let meta = socket.deserializeAttachment();
      let limiter_id = this.env.DEBOUNCE.idFromString(meta.limiter_id)
      let limiter = new RateLimitedClient(
        () => this.env.limiters.get(limiter_id),
        // Using error code 1011 as above (server terminating, unexpected)
        // from https://www.rfc-editor.org/rfc/rfc6455.html#section-7.4.1
        err => socket.close(1011, err.stack));

      this.sessions.set(socket, { ...meta, limiter, blocked: [] });
    });

    this.lastUpdated = 0;
  }

  async fetch(request) {
    return await handleErrors(request, async () => {
      let url = new URL(request.url);

      switch (url.pathname) {
        // <room_url>/websocket -- client is trying to create a new ws: connection.
        case "/websocket": {
          if (request.headers.get("Upgrade") != "websocket") {
            return new Response("expected websocket", {status: 400});
          }

          let ip_addr = request.headers.get("CF-Connecting-IP");
          let pair = new WebSocketPair();
          await this.acceptSession(pair[1], ip_addr);

          return new Response(null, {
            status: 101,
            socket: pair[0] })
        }

        default:
          return new Response("not found", {status: 404});
      }
    });
  }

  // accepts the websocket-based connection
  async acceptSession(web_socket, ip_addr) {
    this.state.acceptWebSocket(web_socket);

    let limiter_id = this.env.limiters.idFromName(ip_addr);
    let limiter = new RateLimitedClient(
      () => this.env.limiters.get(limiter_id),
      err => web_socket.close(1011, err.stack));

    let session = { limiter_id, limiter, blocked: [] };
    web_socket.serializeAttachment({
      ...web_socket.deserializeAttachment(),
      limiter_id: limiter_id.toString() });
    this.sessions.set(web_socket, session);

    for (let other_session of this.sessions.values()) {
      if (other_session.name) {
        session.blocked.push(
          JSON.stringify({joined: other_session.name}));
      }
    }

    let storage = await this.storage.list({reverse: true, limit: 100});
    let backlog = [...storage.values()];
    backlog.reverse();
    backlog.forEach(value => {
      session.blocoked.push(value);
    });
  }

  async webSocketMessage(socket, msg) {
    try {
      let session = this.sessions.get(socket);
      if (session.quit) {
        // TODO
      }
    } catch (err) {
      socket.send(JSON.stringify({error: err.stack, message: err.message}));
    }
  }

  async webSocketClose(socket /*, code, reason, wasClean */) {
    this.closeOrHandleError(socket);
  }

  async webSocketError(socket /*, error */) {
    this.closeOrHandleError(socket);
  }

  async closeOrHandleError(socket) {
    let session = this.sessions.get(socket) || {};
    session.quit = true;
    this.sessions.delete(socket);
    if (session.name) {
      this.broadcast({quit: session.name});
    }
  }


  broadcast(message) {
    // convert to JSON string if not already encoded as a string.
    if (typeof message !== "string") {
      message = JSON.stringify(message);
    }

    // safely send the message to all connected sessions
    let quitters = [];
    this.sessions.forEach((session, socket) => {
      if (session.name) {
        try {
          socket.send(message);
        } catch (err) {
          session.quit = true;
          quitters.push(session);
          this.sessions.delete(socket);
        }
      } else {
        session.blocked.push(message);
      }
    });

    quitters.forEach(quitter => {
      if (quitter.name) {
        this.broadcast({quit: quitter.name});
      }
    });
  }
}


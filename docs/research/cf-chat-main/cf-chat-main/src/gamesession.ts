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

import { DurableObject } from "cloudflare:workers";
import { Env } from "./env";
import { Player } from "./player";

// The number of player actions and the number of players must match,
// even if the only valid and legal move for a Player is the no-op.
interface MatchHistory {
  players: Player[];
  
  // The ordering is implied by the list of players in replay.
  actions: string[][]; 
}

// The actual contents of a game's session, represented as a Durable Object.
export class GameSession extends DurableObject<Env> {
  private playerOne: Player;
  private playerTwo: Player;
  private observers: Player[] = [];

  private _history: MatchHistory;

  // Sentinel value for the zero-value representation of the player.
  private UNKNOWN_PLAYER = {'name': '', playing: false} as Player;

  constructor(readonly state: DurableObjectState, env: Env) {
    super(state, env);
    this.playerOne = this.UNKNOWN_PLAYER;
    this.playerTwo = this.UNKNOWN_PLAYER;
    this._history = {
      players: [],
      actions: [],
    }
  }

  public get history(): MatchHistory { return this._history }

  // TODO
}


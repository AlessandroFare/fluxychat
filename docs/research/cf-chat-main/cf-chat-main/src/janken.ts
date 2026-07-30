
import { Player } from "./player"

type Hand = string;
type MatchOutcome = ">" | "<";

const HIDDEN = "_" as Hand;
const LEFT = ">" as Hand;
const RIGHT = "<" as Hand;
const ROCK = "R" as Hand;
const PAPER = "P" as Hand;
const SCISSORS = "S" as Hand;

interface GameState {
  terminal(): Promise<MatchOutcome>;
}

export class JankenState implements GameState {
  constructor(
    private readonly _player1: Player,
    private readonly _player2: Player) {}

  terminal(): Promise<MatchOutcome> {

    // TODO: await non-tie and only resolve when known.
    return new Promise((resolve) => {resolve("<");});
  }
}

const SHAKE = [
  "🫱    🫲",
  " 🫱  🫲",
  "  🫱🫲",
  "   🤝",
];

export class JankenPlayer extends Player {
  private _hand: Hand = HIDDEN;

  constructor(
      name: string,
      hosting: boolean,
      playing: boolean) {
    super(name, hosting, playing)

    if (playing) {
      this._hand = LEFT;
      if (!hosting) {
        this._hand = RIGHT;
      }
    }
  }

  public set hand(hand: Hand) {
    if (hand === ROCK ||
        hand === PAPER ||
        hand === SCISSORS) {
      this._hand = hand;
    } else {
      throw new Error('hand value ' + hand + ' is invalid.');
    }
  }

  public get hand(): Hand {
    return this._hand;
  }
}

// inclusive human color representations, default is system default (simpsons-yellow).
const HandShapes = {
  LEFT: [
    "🤜",
    "🤜🏻",
    "🤜🏼",
    "🤜🏽",
    "🤜🏾",
    "🤜🏿",
  ],
  RIGHT: [
    "🤛",
    "🤛🏻",
    "🤛🏼",
    "🤛🏽",
    "🤛🏾",
    "🤛🏿",
  ],
  ROCK: [
    "✊",
    "✊🏻",
    "✊🏼",
    "✊🏽",
    "✊🏾",
    "✊🏿",
  ],
  PAPER: [
    "🖐️",
    "🖐🏻",
    "🖐🏼",
    "🖐🏽",
    "🖐🏾",
    "🖐🏿",
  ],
  SCISSORS: [
    "✌️",
    "✌🏻",
    "✌🏼",
    "✌🏽",
    "✌🏾",
    "✌🏿",
  ],
};


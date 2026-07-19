

export class Player {
  constructor(
    readonly name: string,
    private readonly _hosting: boolean,
    private readonly _playing: boolean) {}

  public get hosting(): boolean { return this._hosting }
  public get playing(): boolean { return this._playing }
}
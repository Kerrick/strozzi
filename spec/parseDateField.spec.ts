/* eslint @typescript-eslint/no-non-null-assertion: off */
import { expect } from "chai";
import { parseDateField } from "../src/helper/parse/parseDateField";

describe("parseDateField", () => {
  it("should passthrough Date-Objects", () => {
    const date = new Date();
    const parsedDate = parseDateField(date);

    expect(parsedDate).to.be.instanceOf(Date);
    expect(parsedDate).to.be.equal(date);
  });

  it("should handle numbers as unix timestamps", () => {
    const parsedDate = parseDateField(50)!;

    expect(parsedDate).to.be.instanceOf(Date);
    expect(parsedDate.getTime()).to.be.equal(50);
  });

  it("should handle strings of numbers as unix timestamps", () => {
    const parsedDate = parseDateField("50")!;

    expect(parsedDate).to.be.instanceOf(Date);
    expect(parsedDate.getTime()).to.be.equal(50);
  });

  it("should handle strings which are not pure numbers gracefully", () => {
    const date = new Date(1639577227000);
    const parsedDate = parseDateField(date.toUTCString())!;

    expect(parsedDate).to.be.instanceOf(Date);
    expect(parsedDate.getTime()).to.be.equal(date.getTime());
  });

  it("should return undefined if it is not parsable", () => {
    const date = true;
    const parsedDate = parseDateField(date);

    expect(parsedDate).to.be.undefined;
  });
});

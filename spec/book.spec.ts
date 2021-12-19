/* eslint sonarjs/no-duplicate-string: off, @typescript-eslint/no-non-null-assertion: off, no-prototype-builtins: off*/
import { Book } from "../src/Book";
import { Document, Types } from "mongoose";
import { IJournal } from "../src/models/journals";
import { expect } from "chai";
import { stub, spy } from "sinon";
import { transactionModel } from "../src/models/transactions";
import { JournalNotFoundError } from "../src/errors/JournalNotFoundError";

describe("book", function () {
  describe("constructor", () => {
    it("should throw an error when name of book is not a string", () => {
      // @ts-expect-error we need a string
      expect(() => new Book(1337)).to.throw("Invalid value for name provided.");
    });
    it("should throw an error when name of book is empty string", () => {
      expect(() => new Book("")).to.throw("Invalid value for name provided.");
    });
    it("should throw an error when name of book is a string with only whitespace", () => {
      expect(() => new Book(" ")).to.throw("Invalid value for name provided.");
    });
    it("should throw an error when maxAccountPath of book is a fraction", () => {
      expect(() => new Book("MyBook", { maxAccountPath: 3.14 })).to.throw(
        "Invalid value for maxAccountPath provided."
      );
    });
    it("should throw an error when maxAccountPath of book is a negative number", () => {
      expect(() => new Book("MyBook", { maxAccountPath: -3 })).to.throw(
        "Invalid value for maxAccountPath provided."
      );
    });
    it("should throw an error when maxAccountPath of book is not a number", () => {
      // @ts-expect-error we need a number
      expect(() => new Book("MyBook", { maxAccountPath: "7" })).to.throw(
        "Invalid value for maxAccountPath provided."
      );
    });
    it("should throw an error when precision of book is a fraction", () => {
      expect(() => new Book("MyBook", { precision: 3.14 })).to.throw(
        "Invalid value for precision provided."
      );
    });
    it("should throw an error when precision of book is a negative number", () => {
      expect(() => new Book("MyBook", { precision: -3 })).to.throw(
        "Invalid value for precision provided."
      );
    });
    it("should throw an error when precision of book is not a number", () => {
      // @ts-expect-error we need a number
      expect(() => new Book("MyBook", { precision: "7" })).to.throw(
        "Invalid value for precision provided."
      );
    });
  });

  describe("journaling", () => {
    it("should error when trying to use an account with more than three parts", () => {
      expect(() => {
        const book = new Book("MyBookAccounts");
        book.entry("depth test").credit("X:Y:AUD:BTC", 1);
      }).to.throw("Account path is too deep (maximum 3)");
    });

    it("should allow more than 4 subaccounts of third level", async function () {
      const book = new Book("MyBookSubaccounts");
      await book
        .entry("depth test")
        .credit("X:Y:AUD", 1)
        .credit("X:Y:EUR", 1)
        .credit("X:Y:USD", 1)
        .credit("X:Y:INR", 1)
        .credit("X:Y:CHF", 1)
        .debit("CashAssets", 5)
        .commit();

      const result = await book.balance({ account: "X:Y" });
      expect(result.balance).to.be.equal(5);

      const accounts = await book.listAccounts();
      expect(accounts).to.have.lengthOf(8);
      expect(accounts).to.include("X");
      expect(accounts).to.include("X:Y");
      expect(accounts).to.include("X:Y:AUD");
      expect(accounts).to.include("X:Y:EUR");
      expect(accounts).to.include("X:Y:USD");
      expect(accounts).to.include("X:Y:INR");
      expect(accounts).to.include("X:Y:CHF");
      expect(accounts).to.include("CashAssets");
    });

    it("should let you create a basic transaction", async function () {
      const book = new Book("MyBook-basic-transaction");
      const journal = await book
        .entry("Test Entry")
        .debit("Assets:Receivable", 500, { clientId: "12345" })
        .credit("Income:Rent", 500)
        .commit();
      expect(journal.memo).to.be.equal("Test Entry");
      expect(journal._transactions).to.be.have.lengthOf(2);

      const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
      const journal1 = await book
        .entry("Test Entry 2", threeDaysAgo)
        .debit("Assets:Receivable", 700)
        .credit("Income:Rent", 700)
        .commit();
      expect(journal1.book).to.be.equal("MyBook-basic-transaction");
      expect(journal1.memo).to.be.equal("Test Entry 2");
      expect(journal._transactions).to.be.have.lengthOf(2);
    });

    it("should let you use strings for amounts", async function () {
      const book = new Book("MyBookAmountStrings");
      await book
        .entry("Test Entry")
        .debit("Assets:Receivable", "500", { clientId: "12345" })
        .credit("Income:Rent", "500")
        .commit();
      let result = await book.balance({ account: "Assets" });
      expect(result.balance).to.be.equal(-500);

      result = await book.balance({ account: "Income" });
      expect(result.balance).to.be.equal(500);
    });

    it("should let you use string for original journal", async function () {
      const book = new Book("MyBookAmountStrings");
      const journal = await book
        .entry("Test Entry", null, "012345678901234567890123")
        .debit("Assets:Receivable", "500", { clientId: "12345" })
        .credit("Income:Rent", "500")
        .commit();

      expect(journal._original_journal).to.be.instanceOf(Types.ObjectId);
      expect(journal._original_journal!.toString()).to.be.equal(
        "012345678901234567890123"
      );
    });

    it("should throw INVALID_JOURNAL if an entry total is !=0 and <0", async () => {
      const book = new Book("MyBook-invalid");
      const entry = book.entry("This is a test entry");
      entry.debit("Assets:Cash", 99.9, {});
      entry.credit("Income", 99.8, {});

      try {
        await entry.commit();
        throw new Error("Should have thrown");
      } catch (e) {
        expect((e as Error).message).to.be.equal(
          "INVALID_JOURNAL: can't commit non zero total"
        );
      }
    });

    it("should throw INVALID_JOURNAL if an entry total is !=0 and >0", async () => {
      const book = new Book("MyBook");
      const entry = book.entry("This is a test entry");
      entry.debit("Assets:Cash", 99.8, {});
      entry.credit("Income", 99.9, {});
      try {
        await entry.commit();
        throw new Error("should have thrown");
      } catch (e) {
        expect((e as Error).message).to.be.equal(
          "INVALID_JOURNAL: can't commit non zero total"
        );
      }
    });

    it("should handle extra data when creating an Entry", async () => {
      const book = new Book(
        "MyBook-Entry-Test" + new Types.ObjectId().toString()
      );

      await book
        .entry("extra")
        .credit("A:B", 1, { credit: 2, clientId: "Mr. A" })
        .debit("A:B", 1, { debit: 2, clientId: "Mr. B" })
        .commit();

      const { balance } = await book.balance({ account: "A:B" });
      expect(balance).to.be.equal(0);

      const res = await book.ledger({
        account: "A:B",
      });

      if (res.results[0].meta.clientId === "Mr. A") {
        expect(res.results[0].credit).to.be.equal(2);
        expect(res.results[0].meta.clientId).to.be.equal("Mr. A");
        expect(res.results[1].debit).to.be.equal(2);
        expect(res.results[1].meta.clientId).to.be.equal("Mr. B");
      } else {
        expect(res.results[1].credit).to.be.equal(2);
        expect(res.results[1].meta.clientId).to.be.equal("Mr. A");
        expect(res.results[0].debit).to.be.equal(2);
        expect(res.results[0].meta.clientId).to.be.equal("Mr. B");
      }
    });

    it("should delete transactions when not in transaction and saving the journal fails", async () => {
      const book = new Book(
        "MyBook-Entry-Test" + new Types.ObjectId().toString()
      );

      try {
        await book
          .entry("extra")
          .debit("A:B", 1, { debit: 2, clientId: "Mr. B" })
          // @ts-expect-error mongoose validator should throw error
          .credit("A:B", 1, { credit: 2, timestamp: "asdasd" })
          .commit();
      } catch (e) {
        expect((e as Error).message).to.match(
          /Failure to save journal: Medici_Transaction validation failed/
        );
      }

      const { balance } = await book.balance({ account: "A:B" });
      expect(balance).to.be.equal(0);
    });

    it("should write an error into the console when reverting in non-mongo-transaction fails", async () => {
      const book = new Book(
        "MyBook-Entry-Test" + new Types.ObjectId().toString()
      );

      const deleteManyStub = stub(transactionModel, "deleteMany").throws(
        new Error()
      );
      const consoleErrorStub = stub(console, "error");

      try {
        await book
          .entry("extra")
          .debit("A:B", 1, { debit: 2, clientId: "Mr. B" })
          // @ts-expect-error mongoose validator should throw an error
          .credit("A:B", 1, { credit: 2, timestamp: "asdasd" })
          .commit();
      } catch (e) {
        expect((e as Error).message).to.match(
          /Failure to save journal: Medici_Transaction validation failed/
        );
      }

      expect(consoleErrorStub.firstCall.args[0]).match(
        /Can't delete txs for journal [a-f0-9]{24}. Medici ledger consistency got harmed./
      );
      deleteManyStub.restore();
      consoleErrorStub.restore();

      const { balance } = await book.balance({ account: "A:B" });
      expect(balance).to.be.equal(-2);
    });

    describe("approved/pending transactions", function () {
      let pendingJournal:
        | (Document &
            IJournal & {
              _original_journal?: Types.ObjectId;
            })
        | null = null;

      const book = new Book("MyBookPendingTransactions");

      it("should not include pending transactions in balance", async () => {
        pendingJournal = await book
          .entry("Test Entry")
          .debit("Foo", 500)
          .credit("Bar", 500)
          .setApproved(false)
          .commit();
        const fooBalance = await book.balance({
          account: "Foo",
        });
        expect(fooBalance.balance).to.be.equal(0);
        const barBalance = await book.balance({
          account: "Bar",
        });
        expect(barBalance.balance).to.be.equal(0);
      });

      it("should set all transactions to approved when approving the journal", async () => {
        if (!pendingJournal) {
          throw new Error("pendingJournal missing.");
        }
        pendingJournal.approved = true;
        await pendingJournal.save();
        const fooBalance = await book.balance({
          account: "Foo",
        });
        expect(fooBalance.balance).to.be.equal(-500);
        const barBalance = await book.balance({
          account: "Bar",
        });
        expect(barBalance.balance).to.be.equal(500);
      });
    });
  });

  describe("balance", () => {
    const book = new Book("MyBook-balance");

    before(async () => {
      await book
        .entry("Test Entry")
        .debit("Assets:Receivable", 700)
        .credit("Income:Rent", 700)
        .commit();
      await book
        .entry("Test Entry")
        .debit("Assets:Receivable", 500, { clientId: "12345" })
        .credit("Income:Rent", 500)
        .commit();
    });

    it("should give you the balance by page and start by page 1 if page is not defined", async () => {
      const data = await book.balance({
        account: "Assets",
        perPage: 1,
      });
      expect(data.balance).to.be.equal(-1200);
    });

    it("should give you the balance by page", async () => {
      const data = await book.balance({
        account: "Assets",
        perPage: 1,
        page: 1,
      });
      expect(data.balance).to.be.equal(-1200);

      const data1 = await book.balance({
        account: "Assets",
        perPage: 1,
        page: 2,
      });
      expect(data1.balance).to.be.equal(-700);

      const data2 = await book.balance({
        account: "Assets",
        perPage: 1,
        page: 3,
      });
      expect(data2.balance).to.be.equal(0);
    });

    it("should deal with JavaScript rounding weirdness", async function () {
      const book = new Book("MyBook-balance-rounding");
      await book
        .entry("Rounding Test")
        .credit("A:B", 1005)
        .debit("A:B", 994.95)
        .debit("A:B", 10.05)
        .commit();
      const result1 = await book.balance({ account: "A:B" });
      const { balance } = result1;
      expect(balance).to.be.equal(0);
    });

    it("should have updated the balance for assets and income and accurately give balance for subaccounts", async () => {
      {
        const data = await book.balance({
          account: "Assets",
        });
        const { notes, balance } = data;
        expect(notes).to.be.equal(2);
        expect(balance).to.be.equal(-1200);
      }
      {
        const data1 = await book.balance({ account: "Assets:Receivable" });
        const { notes, balance } = data1;
        expect(balance).to.be.equal(-1200);
        expect(notes).to.be.equal(2);
      }
      {
        const data2 = await book.balance({
          account: "Assets:Other",
        });
        const { notes, balance } = data2;
        expect(balance).to.be.equal(0);
        expect(notes).to.be.equal(0);
      }
    });
  });

  describe("journal.void", () => {
    const book = new Book("MyBook-journal-void");
    let journal:
      | (Document &
          IJournal & {
            _original_journal?: Types.ObjectId;
          })
      | null = null;

    before(async () => {
      await book
        .entry("Test Entry")
        .debit("Assets:Receivable", 700)
        .credit("Income:Rent", 700)
        .commit();
      journal = await book
        .entry("Test Entry")
        .debit("Assets:Receivable", 500, { clientId: "12345" })
        .credit("Income:Rent", 500)
        .commit();
    });

    it("should throw an JournalNotFoundError if journal does not exist", async () => {
      try {
        await book.void(new Types.ObjectId());
        throw new Error("Should have thrown.");
      } catch (e) {
        expect(e).to.be.instanceOf(JournalNotFoundError);
      }
    });

    it("should throw an JournalNotFoundError if journal does not exist in book", async () => {
      const anotherBook = new Book("AnotherBook");

      const anotherJournal = await anotherBook
        .entry("Test Entry")
        .debit("Assets:Receivable", 700)
        .credit("Income:Rent", 700)
        .commit();
      try {
        await book.void(anotherJournal._id);
        throw new Error("Should have thrown.");
      } catch (e) {
        expect(e).to.be.instanceOf(JournalNotFoundError);
      }
    });

    it("should allow you to void a journal entry", async () => {
      if (!journal) {
        throw new Error("journal missing.");
      }
      const data = await book.balance({
        account: "Assets",
        clientId: "12345",
      });
      expect(data.balance).to.be.equal(-500);

      await book.void(journal._id, "Messed up");
      const clientAccount = await book.balance({
        account: "Assets",
        clientId: "12345",
      });
      expect(clientAccount.balance).to.be.equal(0);
      const data1 = await book.balance({
        account: "Assets",
      });
      expect(data1.balance).to.be.equal(-700);

      const data2 = await book.balance({
        account: "Assets",
        clientId: "12345",
      });
      expect(data2.balance).to.be.equal(0);
    });

    it("should throw an error if journal was already voided", async () => {
      if (!journal) {
        throw new Error("journal missing.");
      }
      try {
        await book.void(journal._id, "Messed up");
        throw new Error("Should have thrown.");
      } catch (e) {
        expect((e as Error).message).to.be.equal("Journal already voided.");
      }
    });

    it("should create the correct memo fields when reason is given", async () => {
      const journal = await book
        .entry("Test Entry")
        .debit("Assets:Receivable", 700)
        .credit("Income:Rent", 700)
        .commit();

      const voidedJournal = await book.void(journal._id, "Void reason");

      const updatedJournal = (await book.ledger({ _journal: journal._id }))
        .results[0];

      expect(updatedJournal.memo).to.be.equal("Test Entry");
      expect(updatedJournal.void_reason).to.be.equal("Void reason");

      expect(voidedJournal.memo).to.be.equal("Void reason");
      expect(voidedJournal.void_reason).to.be.equal(undefined);
    });

    it("should create the correct memo fields when reason was not given", async () => {
      const journal = await book
        .entry("Test Entry")
        .debit("Assets:Receivable", 700)
        .credit("Income:Rent", 700)
        .commit();

      const voidedJournal = await book.void(journal._id);

      const updatedJournal = (await book.ledger({ _journal: journal._id }))
        .results[0];

      expect(updatedJournal.memo).to.be.equal("Test Entry");
      expect(updatedJournal.void_reason).to.be.equal("[VOID] Test Entry");

      expect(voidedJournal.memo).to.be.equal("[VOID] Test Entry");
      expect(voidedJournal.void_reason).to.be.equal(undefined);
    });
  });

  describe("listAccounts", () => {
    const book = new Book("MyBook-listAccounts");

    before(async () => {
      await book
        .entry("depth test")
        .credit("Assets:Receivable", 1)
        .debit("Income:Rent", 1)
        .commit();
    });

    it("should list all accounts", async () => {
      const accounts = await book.listAccounts();
      expect(accounts).to.have.lengthOf(4);
      expect(accounts).to.include("Assets");
      expect(accounts).to.include("Assets:Receivable");
      expect(accounts).to.include("Income");
      expect(accounts).to.include("Income:Rent");
    });
  });

  describe("ledger", () => {
    const book = new Book("MyBook-ledger");
    before(async () => {
      await book
        .entry("ledger test 1")
        .credit("Assets:Receivable", 1)
        .debit("Income:Rent", 1)
        .commit();

      await book
        .entry("ledger test 2")
        .debit("Income:Rent", 1)
        .credit("Assets:Receivable", 1)
        .commit();

      await book
        .entry("ledger test 3")
        .debit("Income:Rent", 1)
        .credit("Assets:Receivable", 1)
        .commit();
    });

    it("should return full ledger", async () => {
      const res = await book.ledger({
        account: "Assets",
      });
      expect(res.results).to.have.lengthOf(3);
    });

    it("should return full ledger with hydrated objects when lean is not set", async () => {
      const res = await book.ledger({
        account: "Assets",
      });
      expect(res.results).to.have.lengthOf(3);
      expect(res.results[0]).to.not.have.property("_doc");
      expect(res.results[1]).to.not.have.property("_doc");
      expect(res.results[2]).to.not.have.property("_doc");
    });

    it("should return full ledger with hydrated objects when lean is set to false", async () => {
      const res = await book.ledger(
        {
          account: "Assets",
        },
        undefined,
        { lean: false }
      );
      expect(res.results).to.have.lengthOf(3);
      expect(res.results[0]).to.have.property("_doc");
      expect(res.results[1]).to.have.property("_doc");
      expect(res.results[2]).to.have.property("_doc");
    });

    it("should return full ledger with lean objects when lean is set to true", async () => {
      const res = await book.ledger(
        {
          account: "Assets",
        },
        null,
        { lean: true }
      );
      expect(res.results).to.have.lengthOf(3);
      expect(res.results[0]).to.not.have.property("_doc");
      expect(res.results[1]).to.not.have.property("_doc");
      expect(res.results[2]).to.not.have.property("_doc");
    });

    it("should return full ledger with just ObjectId of the _journal attribute", async () => {
      const res = await book.ledger({
        account: "Assets",
      });
      expect(res.results).to.have.lengthOf(3);
      expect(res.results[0]._journal).to.be.instanceof(Types.ObjectId);
      expect(res.results[1]._journal).to.be.instanceof(Types.ObjectId);
      expect(res.results[2]._journal).to.be.instanceof(Types.ObjectId);
    });

    it("should return full ledger with populated _journal", async () => {
      const res = await book.ledger(
        {
          account: "Assets",
        },
        ["_journal"]
      );
      expect(res.results).to.have.lengthOf(3);
      expect(res.results[0]._journal._id).to.be.instanceof(Types.ObjectId);
      expect(res.results[1]._journal._id).to.be.instanceof(Types.ObjectId);
      expect(res.results[2]._journal._id).to.be.instanceof(Types.ObjectId);
    });

    it("should ignore populate if the field does not exist", async () => {
      const populateSpy = spy(transactionModel, "populate");
      await book.ledger(
        {
          account: "Assets",
        },
        ["notExisting", "_journal"]
      );
      expect(populateSpy.callCount).to.be.equal(1);
      populateSpy.restore();
    });

    it("should return ledger with array of accounts", async () => {
      const res = await book.ledger({
        account: ["Assets", "Income"],
      });
      expect(res.results).to.have.lengthOf(6);
      let assets = 0;
      let income = 0;
      for (const result of res.results) {
        if (result.account_path.includes("Assets")) {
          assets++;
        }
        if (result.account_path.includes("Income")) {
          income++;
        }
      }
      expect(assets).to.be.equal(3);
      expect(income).to.be.equal(3);
    });

    it("should give you a paginated ledger when requested", async () => {
      const response = await book.ledger({
        account: ["Assets", "Income"],
        perPage: 2,
        page: 3,
      });
      expect(response.results).to.have.lengthOf(2);
      expect(response.total).to.be.equal(6);
      expect(response.results[0].memo).to.be.equal("ledger test 1");
      expect(response.results[1].memo).to.be.equal("ledger test 1");
    });

    it("should give you a paginated ledger when requested and start by page 1 if page is not defined", async () => {
      const response = await book.ledger({
        account: ["Assets", "Income"],
        perPage: 2,
      });
      expect(response.results).to.have.lengthOf(2);
      expect(response.total).to.be.equal(6);
      expect(response.results[0].memo).to.be.equal("ledger test 3");
      expect(response.results[1].memo).to.be.equal("ledger test 3");
    });

    it("should give you a paginated ledger when requested and start by page 1 if page is defined", async () => {
      const response = await book.ledger({
        account: ["Assets", "Income"],
        perPage: 2,
        page: 1,
      });
      expect(response.results).to.have.lengthOf(2);
      expect(response.total).to.be.equal(6);
      expect(response.results[0].memo).to.be.equal("ledger test 3");
      expect(response.results[1].memo).to.be.equal("ledger test 3");
    });

    it("should retrieve transactions by time range", async () => {
      const book = new Book("MyBook_time_range");
      await book
        .entry("Test Entry")
        .debit("Assets:Receivable", 500, { clientId: "12345" })
        .credit("Income:Rent", 500)
        .commit();
      const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
      await book
        .entry("Test Entry 2", threeDaysAgo)
        .debit("Assets:Receivable", 700)
        .credit("Income:Rent", 700)
        .commit();

      const fourDaysAgo = new Date(Date.now() - 4 * 24 * 60 * 60 * 1000);
      const endDate = new Date(); // today

      const { total } = await book.ledger({
        account: "Income",
        start_date: fourDaysAgo,
        end_date: endDate,
      });

      expect(total).to.be.equal(2);
    });
  });
});

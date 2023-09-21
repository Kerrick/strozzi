# strozzi (WIP)

Double-entry accounting system for [browsers](https://developer.mozilla.org/en-US/docs/Glossary/Browser) + [dexie](https://dexie.org)

This library is a work in progress, and is being forked from [medici](https://github.com/flash-oss/medici), a double-entry accounting system for [nodejs](https://nodejs.org) + [mongoose](https://mongoosejs.com).

## Basics

To use Strozzi you will need a working knowledge of JavaScript and Dexie.

Strozzi divides itself into "books", each of which store _journal entries_ and their child _transactions_. The cardinal rule of double-entry accounting is that "for every debit entry, there must be a corresponding credit entry" which means "everything must balance out to zero", and that rule is applied to every journal entry written to the book. If the transactions for a journal entry do not balance out to zero, the system will throw a new error with the message `INVALID JOURNAL`.

Books simply represent the physical book in which you would record your transactions - on a technical level, the "book" attribute simply is added as a key-value pair to both the `Medici_Transactions` and `Medici_Journals` collection to allow you to have multiple books if you want to.

Each transaction in Strozzi is for one account. Additionally, sub accounts can be created, and are separated by a colon. Transactions to the Assets:Cash account will appear in a query for transactions in the Assets account, but will not appear in a query for transactions in the Assets:Property account. This allows you to query, for example, all expenses, or just "office overhead" expenses (Expenses:Office Overhead).

In theory, the account names are entirely arbitrary, but you will likely want to use traditional accounting sections and subsections like assets, expenses, income, accounts receivable, accounts payable, etc. But, in the end, how you structure the accounts is entirely up to you.

## Limitations:

- You can safely add values up to 9007199254740991 (Number.MAX_SAFE_INTEGER) and by default down to 0.00000001 (precision: 8).
- Anything more than 9007199254740991 or less than 0.00000001 (precision: 8) is not guaranteed to be handled properly.

You can set the floating point precision as follows:

```javascript
const myBook = new Book("MyBook", { precision: 7 });
```

## Writing journal entries

Writing a journal entry is very simple. First you need a `book` object:

```js
import { Book } from "strozzi";

// The first argument is the book name, which is used to determine which book the transactions and journals are queried from.
const myBook = new Book("MyBook");
```

Now write an entry:

```js
// You can specify a Date object as the second argument in the book.entry() method if you want the transaction to be for a different date than today
const journal = await myBook
  .entry("Received payment")
  .debit("Assets:Cash", 1000)
  .credit("Income", 1000, { client: "Joe Blow" })
  .commit();
```

You can continue to chain debits and credits to the journal object until you are finished. The `entry.debit()` and `entry.credit()` methods both have the same arguments: (account, amount, meta).

You can use the "meta" field which you can use to store any additional information about the transaction that your application needs. In the example above, the `client` attribute is added to the transaction in the `Income` account, so you can later use it in a balance or transaction query to limit transactions to those for Joe Blow.

## Querying Account Balance

To query account balance, just use the `book.balance()` method:

```js
const { balance } = await myBook.balance({
  account: "Assets:Accounts Receivable",
  client: "Joe Blow",
});
console.log("Joe Blow owes me", balance);
```

Note that the `meta` query parameters are on the same level as the default query parameters (account, \_journal, start_date, end_date). Medici parses the query and automatically turns any values that do not match top-level schema properties into meta parameters.

## Retrieving Transactions

To retrieve transactions, use the `book.ledger()` method (here I'm using moment.js for dates):

```js
const startDate = moment().subtract("months", 1).toDate(); // One month ago
const endDate = new Date(); // today

const { results, total } = await myBook.ledger({
  account: "Income",
  start_date: startDate,
  end_date: endDate,
});
```

## Voiding Journal Entries

Sometimes you will make an entry that turns out to be inaccurate or that otherwise needs to be voided. Keeping with traditional double-entry accounting, instead of simply deleting that journal entry, Medici instead will mark the entry as "voided", and then add an equal, opposite journal entry to offset the transactions in the original. This gives you a clear picture of all actions taken with your book.

To void a journal entry, you can either call the `void(void_reason)` method on a Strozzi_Journal document, or use the `book.void(journal_id, void_reason)` method if you know the journal document's ID.

```js
await myBook.void("5eadfd84d7d587fb794eaacb", "I made a mistake");
```

If you do not specify a void reason, the system will set the memo of the new journal to the original journal's memo prepended with "[VOID]".

## ACID checks of an account balance

Sometimes you need to guarantee that an account balance never goes negative. You can employ Dexie ACID transactions for that.

## Document Schema

Journals are schemed in Dexie as follows:

```js
// TODO
```

Transactions are schemed as follows:

```js
// TODO
```

Note that the `book`, `datetime`, `memo`, `voided`, and `void_reason` attributes are duplicates of their counterparts on the Journal document. These attributes will pretty much be needed on every transaction search, so they are added to the Transaction document to avoid having to populate the associated Journal every time.

'use strict';

// A drop-in shim that reproduces the subset of the `node-sqlite3` callback API
// used across this codebase, backed by Bun's native `bun:sqlite`. This lets the
// ~39 files that call db.run/get/all/serialize/prepare keep working unchanged
// when the bot runs under Bun (node-sqlite3's native addon misbehaves under Bun —
// notably `this.changes` comes back undefined, which would break every atomic
// `WHERE balance >= ?` guard).
//
// bun:sqlite is synchronous, so SQL executes immediately. Callbacks are dispatched
// SYNCHRONOUSLY (not on a microtask): this keeps multi-statement transactions —
// e.g. BEGIN ... COMMIT where the COMMIT is nested inside a db.get callback
// (FactionManager.modifyReputation) — fully contained within one synchronous call,
// so a transaction is never left open across an await/microtask boundary (which
// would make a second BEGIN throw "cannot start a transaction within a transaction").
// Callers wrap these callbacks in Promises, so synchronous resolution is safe.

const { Database: BunDatabase } = require('bun:sqlite');

// Turn node-sqlite3-style variadic params (either a single array or spread args,
// optionally followed by a callback) into { params, cb }.
function parseArgs(args) {
    let cb = null;
    if (args.length && typeof args[args.length - 1] === 'function') {
        cb = args[args.length - 1];
        args = args.slice(0, -1);
    }
    let params = (args.length === 1 && Array.isArray(args[0])) ? args[0] : args;
    // bun:sqlite throws on `undefined`; node-sqlite3 binds it as NULL.
    params = params.map((p) => (p === undefined ? null : p));
    return { params, cb };
}

class BunSqliteDatabase {
    constructor(filename, cb) {
        try {
            this._db = new BunDatabase(filename);
            // Match the node-sqlite3 setup used by EconomyDB.
            this._db.exec('PRAGMA foreign_keys = ON;');
            if (typeof cb === 'function') cb(null);
        } catch (err) {
            if (typeof cb === 'function') cb(err);
            else throw err;
        }
    }

    run(sql, ...rest) {
        const { params, cb } = parseArgs(rest);
        let result, err = null;
        try {
            result = this._db.query(sql).run(...params);
        } catch (e) {
            err = e;
        }
        // Dispatch the callback OUTSIDE the execution try/catch so an exception
        // thrown by the callback propagates to the caller (matching node-sqlite3)
        // instead of being mistaken for a query error.
        if (cb) {
            if (err) cb.call({ changes: 0, lastID: 0 }, err);
            else cb.call({ changes: result.changes, lastID: Number(result.lastInsertRowid) }, null);
        } else if (err) {
            console.error(`[bun:sqlite] run error: ${err.message}\n  SQL: ${sql}`);
        }
        return this;
    }

    get(sql, ...rest) {
        const { params, cb } = parseArgs(rest);
        let row, err = null;
        try {
            row = this._db.query(sql).get(...params);
        } catch (e) {
            err = e;
        }
        if (cb) {
            if (err) cb(err, undefined);
            else cb(null, row === null ? undefined : row);
        } else if (err) {
            console.error(`[bun:sqlite] get error: ${err.message}\n  SQL: ${sql}`);
        }
        return this;
    }

    all(sql, ...rest) {
        const { params, cb } = parseArgs(rest);
        let rows, err = null;
        try {
            rows = this._db.query(sql).all(...params);
        } catch (e) {
            err = e;
        }
        if (cb) {
            if (err) cb(err, []);
            else cb(null, rows);
        } else if (err) {
            console.error(`[bun:sqlite] all error: ${err.message}\n  SQL: ${sql}`);
        }
        return this;
    }

    // bun:sqlite is synchronous; running the function inline preserves the
    // statement ordering node-sqlite3's serialize() guarantees.
    serialize(fn) {
        if (typeof fn === 'function') fn();
        return this;
    }

    prepare(sql) {
        const stmt = this._db.prepare(sql);
        return {
            run: (...args) => {
                const { params, cb } = parseArgs(args);
                let result, err = null;
                try {
                    result = stmt.run(...params);
                } catch (e) {
                    err = e;
                }
                if (cb) {
                    if (err) cb.call({ changes: 0, lastID: 0 }, err);
                    else cb.call({ changes: result.changes, lastID: Number(result.lastInsertRowid) }, null);
                } else if (err) {
                    console.error(`[bun:sqlite] prepared run error: ${err.message}\n  SQL: ${sql}`);
                }
            },
            finalize: (cb) => {
                try { stmt.finalize(); } catch { /* already finalized */ }
                if (typeof cb === 'function') cb(null);
            }
        };
    }

    close(cb) {
        try {
            this._db.close();
            if (typeof cb === 'function') cb(null);
        } catch (err) {
            if (typeof cb === 'function') cb(err);
        }
    }
}

module.exports = BunSqliteDatabase;

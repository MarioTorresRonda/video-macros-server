import sqlite3 from 'sqlite3'
import { open } from 'sqlite'

// you would have to import / invoke this in another file
export function openDB() {
  return new sqlite3.Database('/etc/matoro/videoEncoder.db', sqlite3.OPEN_READWRITE, (err) => {
    if (err) {
      return console.error('Error opening database:', err.message);
    }
    console.log('Conectado a la BD de sqlite3');
  });
}

function queryRun(db, sql, params = []) {
    return new Promise((resolve, reject) => {
        // Must use 'function' keyword here so 'this' contains lastID and changes
        db.run(sql, params, function (err) {
            if (err) reject(err);
            else resolve({ lastID: this.lastID, changes: this.changes });
        });
    });
}

export async function execDB( db, query, params ) {
  return await queryRun(db, query, params)
}

function queryAll(db, sql, params = []) {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
}

export async function readDB( db, query ) {
  return await queryAll( db, query );
}

export async function createDB( db ) {

  let result;
  result = await db.all(`SELECT name FROM sqlite_master WHERE type='table' AND name='options';`)
  if ( result.length == 0) {
      await db.exec('CREATE TABLE options (param TEXT, value TEXT)')
      await db.exec('INSERT INTO options VALUES ("mainFolder", "C:\\Users\\mario\\Videos")')
      await db.exec('INSERT INTO options VALUES ("formattedFolder", "C:\\Users\\mario\\Videos\\F")')
      await db.exec('INSERT INTO options VALUES ("uploadFolder", "C:\\Users\\mario\\Videos\\Subir")')
  }
  
  result = await db.all(`SELECT name FROM sqlite_master WHERE type='table' AND name='videos';`)
  if ( result.length == 0) {
      await db.exec('CREATE TABLE videos (id TEXT, format TEXT, fields TEXT, fullName TEXT )')
  }

  result = await db.all(`SELECT name FROM sqlite_master WHERE type='table' AND name='compress';`)
  if ( result.length == 0) {
      await db.exec('CREATE TABLE compress ( dirPath TEXT, fileName TEXT )')
  }

    result = await db.all(`SELECT name FROM sqlite_master WHERE type='table' AND name='merge';`)
  if ( result.length == 0) {
      await db.exec('CREATE TABLE merge ( mergeID TEXT, videoID TEXT )')
  }
} 
import { execDB, readDB } from "../util/sqliteUtils.js";

export async function addVideo( db, id, format, fields, fullName ) {
    const query = `INSERT INTO videos (id, format, fields, fullName) VALUES ( ?, ?, ?, ? )`
    console.log( "Inserted video: ", query, [ id, format, fields, fullName ] );
    await execDB( db, query, [ id, format, fields, fullName ] );
}

export async function readVideo( db ) {
    console.log( TODO )
}

export async function deleteVideo( db, id  )  {
    const query = `DELETE FROM videos where id = ?`
    //console.log( "DELETE toMerge file: ", query, [ outputPath, outputName ] );
    await execDB( db, query, [ id ] );
}

export async function readMaxVideoID( db ) {
    const query = 'SELECT max(id) as mid FROM videos;';
    //console.log( query );
    
    const result = await readDB( db, query);
    return result[0].mid;
}

export async function updateMerge( db )  {
    console.log( TODO )
}

export async function deleteMerge( db )  {
    console.log( TODO )
}
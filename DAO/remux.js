import remuxVideo from "../ffmpeg/remux.js";
import { execDB, readDB } from "../util/sqliteUtils.js";
import { sleep } from "../util/time.js";

export async function addRemux( db, path, videoName ) {

    const query = `INSERT INTO toRemux (dirPath, fileName, progress ) VALUES ( ?, ?, 0 )`
    //console.log( "Inserted remux file: ", query, [ path, videoName ] );
    await execDB( db, query, [ path, videoName ] );
}

export async function readRemux( db ) {
    const query = 'SELECT dirPath, fileName, progress FROM toRemux;';
    //console.log( query );
    
    const result = await readDB( db, query);
    const toRemuxFiles = [];
    result.forEach( (row) => {
        toRemuxFiles.push( { dirPath: row.dirPath, fileName: row.fileName, progress : row.progress } );
    });
    return toRemuxFiles;
}

export async function updateRemux( db, path, videoName, progress )  {
    const query = `UPDATE toRemux set progress = ? where dirPath = ? and fileName = ?`
    //console.log( "UPDATE toRemux file: ", query, [ progress, path, videoName ] );
    await execDB( db, query, [ progress, path, videoName ] );
}

export async function deleteRemux( db, path, videoName )  {
    const query = `DELETE FROM toRemux where dirPath = ? and fileName = ?`
    //console.log( "DELETE toRemux file: ", query, [ path, videoName ] );
    await execDB( db, query, [ path, videoName ] );
}

function process( db, path, videoName, val ) {
    updateRemux(db, path, videoName, val )
}

export async function remuxD( db ) {
    while( true ) {
        const toRemuxFiles = await readRemux( db );
        if ( toRemuxFiles.length == 0 ) {
            //console.log( "No hay archivos para comprimir")       
        }else{
            console.log( "Se inicia el remux de " + toRemuxFiles.length)       
            for (const file of toRemuxFiles) {
                const newProgressFunction = (val) => { process( db, file.dirPath, file.fileName, val ) }
                const response = await remuxFile(file.dirPath, file.fileName, newProgressFunction );   
                deleteRemux(db, file.dirPath, file.fileName )        
            }
        }
        await sleep(3000);
    }
}

function remuxFile( path, videoName, onProcess ) {
    return new Promise((resolve, reject) => {
        remuxVideo(
            path, videoName,
            (err, outputFile) => { if (err) { reject( err.message); } resolve(outputFile); },
            (progress) => { onProcess( `${progress.percent ? progress.percent.toFixed(1) : '?'}%` ) }
        );
    });
}
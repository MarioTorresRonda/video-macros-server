import compressVideo from "../ffmpeg/compress.js";
import { execDB, readDB } from "../util/sqliteUtils.js";
import { sleep } from "../util/time.js";

export async function addCompress( db, path, videoName ) {

    const query = `INSERT INTO compress (dirPath, fileName, progress ) VALUES ( ?, ?, 0 )`
    //console.log( "Inserted compress file: ", query, [ path, videoName ] );
    await execDB( db, query, [ path, videoName ] );
}

export async function readCompress( db ) {
    const query = 'SELECT dirPath, fileName, progress FROM compress;';
    //console.log( query );
    
    const result = await readDB( db, query);
    const toCompressFiles = [];
    result.forEach( (row) => {
        toCompressFiles.push( { dirPath: row.dirPath, fileName: row.fileName, progress : row.progress } );
    });
    return toCompressFiles;
}

export async function updateCompress( db, path, videoName, progress )  {
    const query = `UPDATE compress set progress = ? where dirPath = ? and fileName = ?`
    //console.log( "UPDATE compress file: ", query, [ progress, path, videoName ] );
    await execDB( db, query, [ progress, path, videoName ] );
}

export async function deleteCompress( db, path, videoName )  {
    const query = `DELETE FROM compress where dirPath = ? and fileName = ?`
    //console.log( "DELETE compress file: ", query, [ path, videoName ] );
    await execDB( db, query, [ path, videoName ] );
}

function process( db, path, videoName, val ) {
    updateCompress(db, path, videoName, val )
}

export async function compressD( db ) {
    while( true ) {
        const toCompressFiles = await readCompress( db );
        if ( toCompressFiles.length == 0 ) {
            //console.log( "No hay archivos para comprimir")       
        }else{
            console.log( "Se inicia compresion de " + toCompressFiles.length)       
            for (const file of toCompressFiles) {
                const newProgressFunction = (val) => { process( db, file.dirPath, file.fileName, val ) }
                const response = await compressFile(file.dirPath, file.fileName, "/mnt/NonRenew/Videos/F/", newProgressFunction );   
                deleteCompress(db, file.dirPath, file.fileName )        
            }
        }
        await sleep(3000);
    }
}

function compressFile( path, videoName, outputPath, onProcess ) {
    return new Promise((resolve, reject) => {
        compressVideo(
            path, videoName, outputPath,
            (err, outputFile) => { if (err) { reject( err.message); } resolve(outputFile); },
            (progress) => { onProcess( `${progress.percent ? progress.percent.toFixed(1) : '?'}%` ) }
        );
    });
}
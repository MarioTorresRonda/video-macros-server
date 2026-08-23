import compressVideo from "../ffmpeg/compress.js";
import configurateVideo from "../ffmpeg/configurate.js";
import { execDB, readDB } from "../util/sqliteUtils.js";
import { sleep } from "../util/time.js";

export async function addConfigure( db, path, videoName, audioChannel, cam ) {

    const query = `INSERT INTO toConfigure (dirPath, fileName, audioChannel, cam, progress ) VALUES ( ?, ?, ?, ?, 0 )`
    //console.log( "Inserted configure file: ", query, [ path, videoName, audioChannel ] );
    await execDB( db, query, [ path, videoName, audioChannel, cam ] );
}

export async function readConfigure( db ) {
    const query = 'SELECT dirPath, fileName, progress, audioChannel, cam FROM toConfigure;';

    const result = await readDB( db, query);
    const toConfigureiles = [];
    result.forEach( (row) => {
        toConfigureiles.push( { dirPath: row.dirPath, fileName: row.fileName, progress : row.progress, audioChannel: row.audioChannel, cam : row.cam } );
    });
    return toConfigureiles;
}

export async function updateConfigure( db, path, videoName, progress )  {
    const query = `UPDATE toConfigure set progress = ? where dirPath = ? and fileName = ?`
    //console.log( "UPDATE compress file: ", query, [ progress, path, videoName ] );
    await execDB( db, query, [ progress, path, videoName ] );
}

export async function deleteConfigure( db, path, videoName )  {
    const query = `DELETE FROM toConfigure where dirPath = ? and fileName = ?`
    //console.log( "DELETE compress file: ", query, [ path, videoName ] );
    await execDB( db, query, [ path, videoName ] );
}

function process( db, path, videoName, val ) {
    updateConfigure(db, path, videoName, val )
}

export async function configureD( db ) {     
    while( true ) {
        const toConfigureiles = await readConfigure( db );
        if ( toConfigureiles.length == 0 ) {
            //console.log( "No hay archivos para comprimir")       
        }else{
            console.log( "Se inicia configuracion de " + toConfigureiles.length)       
            for (const file of toConfigureiles) {
                console.log( file );
                const newProgressFunction = (val) => { process( db, file.dirPath, file.fileName, val ) }
                const response = await configurateFile(file.dirPath, file.fileName, file.audioChannel, file.cam, newProgressFunction );   
                deleteConfigure(db, file.dirPath, file.fileName )        
            }
        }
        await sleep(3000);
    }
}

function configurateFile( path, videoName, audioChannel, cam, onProcess ) {
    return new Promise((resolve, reject) => {
        configurateVideo(
            path, videoName, audioChannel, cam,
            (err, outputFile) => { if (err) { reject( err.message); } resolve(outputFile); },
            (progress) => { onProcess( `${progress.percent ? progress.percent.toFixed(1) : '?'}%` ) }
        );
    });
}
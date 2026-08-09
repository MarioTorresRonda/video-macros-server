
import { mergeVideos } from "../ffmpeg/merge.js";
import { execDB, readDB } from "../util/sqliteUtils.js";
import path from 'node:path';
import { sleep } from "../util/time.js";
import { addVideo, readMaxVideoID } from "./video.js";
import { encodeBase62 } from "../util/base62.js";

export async function addMerge( db, dirPath, uploadPath, newFileName, filesCount, files ) {
    const query = `INSERT INTO toMerge( dirPath, fileNameList, outputPath, outputName, progress ) VALUES ( ?, ?, ?, ?, 0 )`
    //console.log( "Inserted merge file: ", query, [ dirPath, JSON.stringify( files ), uploadPath, newFileName ] );
    await execDB( db, query, [ dirPath, JSON.stringify( files ), uploadPath, newFileName ] );
}

export async function readMerge( db ) {
    const query = 'SELECT dirPath, fileNameList, outputPath, outputName FROM toMerge;';
    //console.log( query );
    
    const result = await readDB( db, query);
    const toMergeFiles = [];
    result.forEach( (row) => {
        toMergeFiles.push( { 
            dirPath: row.dirPath, 
            files: JSON.parse( row.fileNameList ),
            outputPath : row.outputPath,
            outputName  : row.outputName
        } );
    });
    return toMergeFiles;
}

export async function updateMerge( db, outputPath, outputName, progress )  {
    const query = `UPDATE toMerge set progress = ? where dirPath = ? and outputName = ?`
    //console.log( "UPDATE toMerge file: ", query, [ progress, outputPath, outputName ] );
    await execDB( db, query, [ progress, outputPath, outputName ] );
}

export async function deleteMerge( db, outputPath, outputName )  {
    const query = `DELETE FROM toMerge where outputPath = ? and outputName = ?`
    //console.log( "DELETE toMerge file: ", query, [ outputPath, outputName ] );
    await execDB( db, query, [ outputPath, outputName ] );
}

function process( db, outputPath, outputName, val ) {
    updateMerge(db, outputPath, outputName, val )
}

export async function mergeD( db ) {
    while( true ) {
        const toMergeFiles = await readMerge( db );
        if ( toMergeFiles.length == 0 ) {
            //console.log( "No hay archivos para comprimir")       
        }else{
            console.log( "Se inicia compresion de " + toMergeFiles.length)       
            for (const file of toMergeFiles) {
                try{
                    const newProgressFunction = (val) => { process( db, file.outputPath, file.outputName, val ) }
                    const maxId = await readMaxVideoID(db);
                    const newFileName = `${file.outputName}›${encodeBase62(maxId)}.mp4`;
                    addVideo( db, maxId, '', '[]', newFileName )
                    const response = await mergeFile(file.dirPath, file.files, path.join( file.outputPath, newFileName), newProgressFunction );   
                    deleteMerge(db, file.dirPath, file.outputName )        
                }catch(e) {
                    console.log( e )
                }
            }
        }
        await sleep(3000);
    }
}

function mergeFile( dirPath, videoList, outputFile, onProcess ) {
    return new Promise((resolve, reject) => {
        mergeVideos(
            dirPath, videoList, outputFile ,
            (err, outputFile) => { if (err) { reject( err.message); } resolve(outputFile); },
            (progress) => { onProcess( `${progress.percent ? progress.percent.toFixed(1) : '?'}%` ) }
        );
    });
}
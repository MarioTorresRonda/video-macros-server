import express from "express";
import cors from 'cors'
import { addCompress, compressD, readCompress } from "./DAO/compress.js";
import { addMerge, mergeD, readMerge } from "./DAO/merge.js";
import { openDB } from "./util/sqliteUtils.js";
import { addConfigure, configureD, readConfigure } from "./DAO/configureVideo.js";
import { addRemux, readRemux, remuxD } from "./DAO/remux.js";


const db = openDB();
const app = express();
app.use( cors() );

app.get('/Status', async (req, res) => {
  res.send( { 
    status: true, 
    remux: await readRemux(db),
    compress: await readCompress(db), 
    configure: await readConfigure(db), 
    merge: await readMerge(db)
  });
});

app.get('/toRemux', (req, res) => {
  const { dirPath, fileName } = req.query;
  res.send( addRemux( db, dirPath, fileName ) );
});

app.get('/toCompress', (req, res) => {
  const { dirPath, fileName } = req.query;
  res.send( addCompress( db, dirPath, fileName ) );
});

app.get('/toMerge', (req, res) => {
  const { dirPath, uploadPath, newFileName, filesCount } = req.query;
  let files = new Array(filesCount);
  for (let index = 0; index < filesCount; index++) {
    const file = req.query[`file${index}`];
    files[index] = file;
  }
  res.send( addMerge( db, dirPath, uploadPath, newFileName, filesCount, files ) );
});

app.get('/toConfigurate', (req, res) => {
  const { dirPath, fileName, audioChannel, cam } = req.query;
  res.send( addConfigure( db, dirPath, fileName, audioChannel, cam ) );
});

app.listen(5000, () => {
  console.log("Server VideoMacros Iniciado");
});

remuxD( db );
compressD( db );
mergeD( db );
configureD( db );
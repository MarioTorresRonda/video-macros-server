import express from "express";
import cors from 'cors'
import { addCompress, compressD, readCompress } from "./DAO/compress.js";
import { addMerge, mergeD } from "./DAO/merge.js";
import { openDB } from "./util/sqliteUtils.js";
import { addConfigure, configureD } from "./DAO/configureVideo.js";


const db = openDB();
const app = express();
app.use( cors() );

app.get('/Status', async (req, res) => {
  res.send( { status: true, compress: (await readCompress(db)).length });
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
  const { dirPath, fileName, audioChannel } = req.query;
  res.send( addConfigure( db, dirPath, fileName, audioChannel ) );
});

app.listen(5000, () => {
  console.log("Server VideoMacros Iniciado");
});

compressD( db );
mergeD( db );
configureD( db );
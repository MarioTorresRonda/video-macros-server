CREATE TABLE IF NOT EXISTS options (param TEXT, value TEXT);
--INSERT INTO options VALUES ("mainFolder", "C:\\Users\\mario\\Videos")
--INSERT INTO options VALUES ("formattedFolder", "C:\\Users\\mario\\Videos\\F")
--INSERT INTO options VALUES ("uploadFolder", "C:\\Users\\mario\\Videos\\Subir")

CREATE TABLE IF NOT EXISTS videos (id TEXT, format TEXT, fields TEXT, fullName TEXT );
--DROP TABLE compress;
CREATE TABLE IF NOT EXISTS compress ( dirPath TEXT, fileName TEXT, progress NUMBER );
CREATE TABLE IF NOT EXISTS merge ( mergeID TEXT, videoID TEXT );
--DROP TABLE toMerge;
CREATE TABLE IF NOT EXISTS toMerge ( dirPath TEXT, fileNameList TEXT, outputPath TEXT, outputName TEXT, progress NUMBER );
--DROP TABLE IF EXISTS toConfigure;
CREATE TABLE IF NOT EXISTS toConfigure ( dirPath TEXT, fileName TEXT, audioChannel TEXT, cam TEXT, progress NUMBER );
--DROP TABLE IF EXISTS toRemux;
CREATE TABLE IF NOT EXISTS toRemux ( dirPath TEXT, fileName TEXT, progress NUMBER );
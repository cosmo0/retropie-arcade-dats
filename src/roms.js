const fs = require('fs-extra');
const path = require('path');
const events = require('events');
const csvparse = require('csv-parse/lib/sync');

// delimiter
const defaultDelimiter = ';';

module.exports = class Roms extends events {
    /**
     * Adds roms from a romset to a folder,
     * based on a CSV file
     * 
     * @param {string} file The path to the file
     * @param {string} romset The path to the romset folder
     * @param {string} selection The path to the selection folder
     * @param {functiion} callback The callback method
     */
    add (file, romset, selection, callback) {
        this.emit('start.add');

        fs.readFile(file, { 'encoding': 'utf8' }, (err, fileContents) => {
            if (err) throw err;

            let fileCsv = csvparse(
                fileContents,
                {
                    columns: true,
                    auto_parse: false,
                    auto_parse_date: false,
                    delimiter: defaultDelimiter
                });

            console.log('Copying %i files', fileCsv.length);

            let requests = fileCsv.reduce((promisechain, line, index) => {
                return promisechain.then(() => new Promise((resolve) => {
                    let game = line.name;
                    let zip = line.name + '.zip';
                    let sourceRom = path.join(romset, zip);
                    let destRom = path.join(selection, zip);
    
                    this.emit('progress.add', fileCsv.length, index + 1, zip);
    
                    // test if source file exists and destination does not
                    if (fs.existsSync(sourceRom) && !fs.existsSync(destRom)) {
                        // copy rom
                        fs.copy(sourceRom, destRom, (err) => {
                            if (err) throw err;
    
                            // copy CHD
                            let sourceChd = path.join(romset, game);
                            if (fs.existsSync(sourceChd)) {
                                fs.copy(sourceChd, path.join(selection, game), (err) => {
                                    if (err) throw err;
                                    console.log('%s copied', sourceChd);
                                    resolve();
                                });
                            } else {
                                console.log('%s copied', sourceRom);
                                resolve();
                            }
                        });
                    } else {
                        console.log('%s game source not found or rom already copied', game);
                        resolve();
                    }
                }));
            }, Promise.resolve());

            requests.then(() => {
                this.emit('end.add');
                if (callback) callback();
            });
        });
    }

    /**
     * Removes roms from a folder,
     * based on a CSV file
     * 
     * @param {string} file The path to the file
     * @param {string} selection The path to the selection folder
     * @param {functiion} callback The callback method
     */
    remove (file, selection, callback) {
        this.emit('start.remove');

        fs.readFile(file, { 'encoding': 'utf8' }, (err, fileContents) => {
            if (err) throw err;

            let fileCsv = csvparse(
                fileContents,
                {
                    columns: true,
                    auto_parse: false,
                    auto_parse_date: false,
                    delimiter: defaultDelimiter
                });

            let requests = fileCsv.reduce((promisechain, line, index) => {
                return promisechain.then(() => new Promise((resolve) => {
                    let zip = line.name + '.zip';
                    let rom = path.join(selection, zip);

                    this.emit('progress.remove', fileCsv.length, index + 1, zip);

                    // test if rom exists
                    fs.pathExists(rom, (err, romExists) => {
                        if (romExists) {
                            // delete rom
                            fs.remove(rom, (err) => {
                                console.log('%s deleted', rom);
                                resolve();
                            });
                        } else {
                            resolve();
                        }
                    });
                }));
            }, Promise.resolve());

            requests.then(() => {
                this.emit('end.remove');
                if (callback) callback();
            });
        });
    }

    /**
     * Keeps only listed roms in a folder
     * that are listed in a CSV file
     * 
     * @param {string} file The path to the file
     * @param {string} selection The path to the selection folder
     * @param {functiion} callback The callback method
     */
    keep (file, selection, callback) {
        this.emit('start.keep');

        fs.readFile(file, { 'encoding': 'utf8' }, (err, fileContents) => {
            if (err) throw err;
            
            let fileCsv = csvparse(
                fileContents,
                {
                    columns: true,
                    auto_parse: false,
                    auto_parse_date: false,
                    delimiter: defaultDelimiter
                });

            // list files in selection folder
            fs.readdir(selection, (err, files) => {
                if (err) throw err;

                let requests = files.reduce((promisechain, zip, index) => {
                    return promisechain.then(() => new Promise((resolve) => {
                        this.emit('progress.keep', files.length, index + 1, zip);

                        // skip non-zip files
                        if (!zip.endsWith('.zip')) {
                            resolve();
                            return;
                        }

                        // file not found in csv -> remove it
                        let csvItem = fileCsv.find((item) => item.name === zip.replace('.zip', ''));
                        if (typeof csvItem === 'undefined') {
                            console.log('remove %s', zip);
                            fs.remove(path.join(selection, zip), (err) => {
                                resolve();
                            });
                        } else {
                            // file found in csv -> keep it
                            resolve();
                        }
                    }));
                }, Promise.resolve());

                requests.then(() => {
                    this.emit('end.keep');
                    if (callback) callback();
                });
            });
        });
    }
};
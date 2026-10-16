const fs = require('node:fs');
const path = require('node:path');

// Almacenamiento local en JSON compartido por las features de Discord.
// La escritura es atómica (archivo temporal + rename) para que un reinicio
// a mitad de escritura no deje el archivo corrupto.
function createJsonStore(filePath, { createDefault, normalize = store => store }) {
  function read() {
    try {
      return normalize(JSON.parse(fs.readFileSync(filePath, 'utf8')));
    } catch (error) {
      if (error.code === 'ENOENT') return createDefault();
      throw error;
    }
  }

  function write(store) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    const temporaryFile = `${filePath}.tmp`;
    fs.writeFileSync(temporaryFile, `${JSON.stringify(store, null, 2)}\n`);
    fs.renameSync(temporaryFile, filePath);
  }

  function update(mutate) {
    const store = read();
    mutate(store);
    write(store);
    return store;
  }

  return { read, write, update };
}

module.exports = { createJsonStore };

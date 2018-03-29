const fs = require('fs');
const path = require('path');

const SCRIPTS_DIR = path.join(__dirname, '../lua');

function loadScript(name) {
    return fs.readFileSync(path.join(SCRIPTS_DIR, `${name}.lua`), 'utf8');
}

const scripts = {
    ping: {
        numberOfKeys: 0,
        lua: loadScript('ping'),
    },
    msgenqueue: {
        numberOfKeys: 0,
        lua: loadScript('msgenqueue'),
    },
    msgdequeue: {
        numberOfKeys: 0,
        lua: loadScript('msgdequeue'),
    },
    msgack: {
        numberOfKeys: 0,
        lua: loadScript('msgack'),
    },
    msgnack: {
        numberOfKeys: 0,
        lua: loadScript('msgnack'),
    },
    msgerrors: {
        numberOfKeys: 0,
        lua: loadScript('msgerrors'),
    },
};

module.exports = scripts;

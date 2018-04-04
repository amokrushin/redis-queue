const fs = require('fs');
const path = require('path');
const template = require('lodash.template');

const SCRIPTS_DIR = path.join(__dirname, '../lua');

function loadScript(name) {
    return fs.readFileSync(path.join(SCRIPTS_DIR, `${name}.lua`), 'utf8');
}

const commands = {
    ping: {
        numberOfKeys: 0,
    },
    msgenqueue: {
        numberOfKeys: 0,
    },
    msgdequeue: {
        numberOfKeys: 0,
    },
    msgack: {
        numberOfKeys: 0,
    },
    msgnack: {
        numberOfKeys: 0,
    },
    msgerrors: {
        numberOfKeys: 0,
    },
};

Object.keys(commands).forEach((name) => {
    const params = commands[name];
    const tpl = template(loadScript(name));
    commands[name] = (context) => ({
        ...params,
        lua: tpl(context),
    });
});

module.exports = commands;

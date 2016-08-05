var fs = require('fs');
var config = require('./local-config.json');

function saveRom(buffer, filename) {
    var buf = new Buffer(buffer.byteLength);
    var view = new Uint8Array(buffer);
    for (var i = 0; i < buf.length; ++i) {
        buf[i] = view[i];
    }
    fs.writeFileSync(config.savepath + '/' + filename, buf);
    return buf;
}
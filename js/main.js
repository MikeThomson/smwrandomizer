var ORIGINAL_ROM = null;
var BASEURL = window.location.origin + window.location.pathname;

var EN_US = false;
var __SMWC = true;

var DEVMODE = window.location.href.indexOf('localhost') != -1;
DEVMODE = true; // leaving in the above for now, trying to keep as merge compatible as possible for now
LOCALMODE = window && window.process && window.process.type;

function doRandomize(buffer, seed)
{
	try
	{
		var __start = +new Date();
		if (console.clear) console.clear();

		var result = randomizeROM(buffer, seed);
		var url = BASEURL + '#!/' + result.seed + '/' + result.preset;

		var category = result.category || "No Starworld";
		var prefix = 'smw-' + VERSION_STRING;

		$('#setgoal-text').val('.setgoal Randomizer ' + VERSION_STRING + ' ' + category + ' - ' + url);
		if(LOCALMODE) {
			saveRom(result.buffer, prefix + '-' + result.seed + result.type);
		} else {
			saveAs(new Blob([result.buffer], {type: "octet/stream"}), prefix + '-' + result.seed + result.type);
		}

        $('#generation-time').remove();
        $('body').append($('<div id="generation-time">').html('&Delta;' + (+new Date() - __start) + "ms"));

		var issuebody = encodeURIComponent('ROM: ' + url + ' (' + result.checksum + ')');
		$('#bugreport').attr('href', 'http://github.com/authorblues/smwrandomizer/issues/new?body=' + issuebody);
	}
	catch (e)
	{
		$('#modal-error-win #modal-error-text').text(e.name + ': ' + e.message);
		$('#modal-error-win #modal-error-list').empty();

		if (e instanceof ValidationError)
			for (var i = 0; i < e.errors.length; ++i)
				$('#modal-error-win #modal-error-list').append($('<li>').text(e.errors[i]).addClass('mono'));

		$('#modal-error-win').modal('show');
		throw e;
	}
}

$('#generate-randomized-rom').click(function(e)
{
	if (!ORIGINAL_ROM) return;

	// maybe this will be a NaN?
	var seed = parseInt($('#custom-seed').val(), 16);

	if (ORIGINAL_ROM === true)
	{
		var xhr = new XMLHttpRequest();
		xhr.open('GET', 'smw.sfc', true);
		xhr.responseType = 'arraybuffer';

		xhr.onload = function(e){ doRandomize(xhr.response, seed); }
		xhr.send();
	}
	else
	{
		var reader = new FileReader();
		reader.onloadend = function(e){ doRandomize(reader.result, seed); };
		reader.readAsArrayBuffer(ORIGINAL_ROM);
	}
});

$('#generate-param-rom').click(function(e)
{
	// maybe this will be a NaN?
	var seed = parseInt($('#custom-seed').val(), 16);

	var xhr = new XMLHttpRequest();
	xhr.open('GET', 'smw.sfc', true);
	xhr.responseType = 'arraybuffer';

	xhr.onload = function(e){ doRandomize(xhr.response, seed); }
	xhr.send();
});

function _validateRandomizer(buffer, maxiter, iter, errors)
{
	for (var i = 0; i < 100 && iter > 0; ++i, --iter)
	{
		var copy = new ArrayBuffer(buffer.byteLength);
		new Uint8Array(copy).set(new Uint8Array(buffer));
		try { randomizeROM(copy); } catch (e) { ++errors; }
	}

	if (iter)
	{
		console.log(Math.floor(100 * (maxiter - iter) / maxiter) + '%... ' + errors + ' (' + Math.round(errors*100/(maxiter-iter)) + '%)');
		setTimeout(_validateRandomizer.bind(this, buffer, maxiter, iter, errors), 100);
	}
	else console.log('Validation complete: ' + errors + ' errors (' + Math.round(errors*100/maxiter) + '%)'); // FIXME
}

function validateRandomizer(iter)
{
	// turn on error reporting
	DEVMODE = false;

	var xhr = new XMLHttpRequest();
	xhr.open('GET', 'smw.sfc', true);
	xhr.responseType = 'arraybuffer';

	iter = iter || 10000;
	xhr.onload = function(e)
	{
		console.log('Starting ' + iter + ' iterations of the randomizer...');
		_validateRandomizer(xhr.response, iter, iter, 0);
	};
	xhr.send();
}

function getMD5(file, callback)
{
	var w = new Worker('js/md5.worker.js');
	w.onmessage = function(e){ callback(e.data); };
	w.postMessage(file);
}

$('#select-original-rom').click(
	function(e){ $('#original-rom').click(); });

$('#original-rom').change(function(e)
{
	checkRomResult(e.target.files.length, e.target.files[0]);
});

$('form').submit(function(e)
{
	e.preventDefault();
	return false;
});

if (window.atob) __SMWC = document.referrer.toLowerCase().indexOf(atob('c213Y2VudHJhbC5uZXQ=')) != -1;
if (!__SMWC)
{
	$('#setgoal-text').removeClass('hidden');
	$('#authorblues').click(function(e)
	{
		checkRomResult(true, true);
		$('#select-original-rom').prop('disabled', true);
	});

	// i don't care if people find these, but they shouldn't be readily accessible
	if (DEVMODE) $('#cheatmenu').removeClass('hidden');
}

$('#view-changelog').click(function(e)
{
	$('#modal-changelog-win .modal-body').load('changelog.html');
	$('#modal-changelog-win').modal('show');
});

function cleanCustomSeed(seed)
{ return seed.replace(/[^a-fA-F0-9]+/g, '').substr(0, 8); }

$('#custom-seed').bind("keypress paste", function(e)
{
	var self = $(this);
	setTimeout(function(){ self.val(cleanCustomSeed(self.val())); }, 1);
});

function checkRomResult(valid, file)
{
	$('#original-rom-result').removeClass('glyphicon-question-sign');
	$('#original-rom-result').toggleClass('glyphicon-ok', valid);
	$('#original-rom-result').toggleClass('glyphicon-remove', !valid);

	$('#generate-randomized-rom').prop('disabled', !valid);

	if (valid) ORIGINAL_ROM = file;
	return valid;
}

function checkHash()
{
	if (!location.hash || location.hash.indexOf("#!/") !== 0) return;
	var parts = location.hash.split('/').slice(1);

	var seed = cleanCustomSeed(parts[0]);
	if (parts.length > 0) $('#custom-seed').val(seed);

	var given = parts.length > 1 ? parts[1] : '0';
	if (given[0] == 'x')
	{
		$('#preset').val(0);
		setRandomizerSettings(given.substr(1));
	}
	else
	{ $('#preset').val(+parts[1]); updatePreset(); }

	if (parts.length > 1)
	{
		$('#modal-download-win .modal-body .seed').text(seed);
		$('#modal-download-win .modal-body .preset').text(getPresetName());
		$('#modal-download-win').modal('show');
	}
}

function deepClone(obj)
{
	if (obj.constructor == Array)
	{
		var x = [], i;
		for (i = 0; i < obj.length; ++i)
			x.push(deepClone(obj[i]));
		return x;
	}
	else if (obj.constructor == Object)
	{
		var x = {};
		for (var k in obj)
			if (obj.hasOwnProperty(k))
				x[k] = deepClone(obj[k]);
		return x;
	}
	else return obj;
}

function compressRLE2(src)
{
	var compress = [], dcopy = [];
	for (var i = 0, len; i < src.length; i += len)
	{
		// determine length of potential RLE segment
		for (var j = 1; src[i] == src[i+j]; ++j);
		var len = j;

		// if this is a worthwhile RLE segment
		if (len > (dcopy.length ? 3 : 1))
		{
			// flush the direct copy buffer
			if (dcopy.length)
			{
				compress.push(dcopy.length - 1);
				for (var k = 0; k < dcopy.length; ++k)
					compress.push(dcopy[k]);
				dcopy = [];
			}

			// add the RLE segment
			compress.push(0x80 | (len - 1));
			compress.push(src[i]);
		}
		// otherwise, hold in direct copy buffer
		else
		{
			// if adding this to the direct copy buffer would
			// overflow the 0x7F length of the RLE opcode
			if (dcopy.length + len > 0x80)
			{
				// flush the buffer
				compress.push(dcopy.length - 1);
				for (var k = 0; k < dcopy.length; ++k)
					compress.push(dcopy[k]);
				dcopy = [];
			}

			while (j--) dcopy.push(src[i]);
		}
	}

	// flush the remaining direct copy values
	if (dcopy.length)
	{
		compress.push(dcopy.length - 1);
		for (var k = 0; k < dcopy.length; ++k)
			compress.push(dcopy[k]);
	}

	// wrap in uint8 array
	return new Uint8Array(compress);
}

function decompressRLE2(src)
{
	var decompress = [];
	for (var i = 0; i < src.length; ++i)
	{
		// get length field from header
		var len = (src[i] & 0x7F) + 1;

		// RLE bit is set
		if (0x80 & src[i])
		{
			// get bit to repeat and repeat it
			var val = src[++i];
			for (var j = 0; j < len; ++j)
				decompress.push(val);
		}
		// direct copy
		else
		{
			// transfer direct copy chunk
			for (var j = 0; j < len; ++j)
				decompress.push(src[++i]);
		}
	}

	// wrap in uint8 array
	return new Uint8Array(decompress);
}

window.onhashchange = checkHash;
checkHash();

Math.sign = Math.sign || function(x)
{
	x = +x;
	if (x > 0) return  1;
	if (x < 0) return -1;
	return 0;
}

Uint8Array.prototype.slice = Uint8Array.prototype.slice || function(start, end)
{
	var src = this.subarray(start, end);
	var dst = new Uint8Array(src.byteLength);
	dst.set(src); return dst;
}

Uint8Array.prototype.writeBytes = function(b, addr, val)
{ var _b = b; for (; b--; val >>= 8) this[addr++] = val & 0xFF; return _b; }

//Uint8Array.prototype.readBytes = function(b, addr)
//{ var x = 0, s = 0; for (; b--; s += 8, addr++) x |= (this[addr] & 0xFF) << s; return x; }

function bitsToHex(_arr)
{
	var arr = _arr.slice(0);

	var h = '', x, i;
	while (arr.length)
	{
		var z = arr.splice(0, 4);
		for (x = 0, i = 0; i < z.length; ++i)
			x |= (z[i] ? 1 : 0) << i;
		h += x.toString(16);
	}

	return h;
}

function hexToBits(x)
{
	for (var a = [], i = 0; i < x.length; ++i)
	{
		var v = parseInt(x[i], 16);
		for (var j = 0; j < 4; v >>= 1, ++j) a.push(v & 1);
	}
	return a;
}

function bitset(x, mask)
{ return (x & mask) == mask; }

function Random(seed)
{ this.seed = Math.floor(seed || (Math.random() * 0xFFFFFFFF)) % 0xFFFFFFFF; }

Random.prototype.clone = function()
{ return new Random(this.seed); }

Random.prototype.pull = function(n)
{ while (n--) this.next(); }

Random.prototype.next = function(z)
{ return this.seed = ((214013 * this.seed + 2531011) & 0x7fffffff) >> 16; }

Random.prototype.nextFloat = function()
{ return this.next() / 0x7fff; }

Random.prototype.flipCoin = function(x)
{ return this.nextFloat() < x; }

// Box-Muller transform, converts uniform distribution to normal distribution
// depends on uniformity of nextFloat(), which I'm not confident of
Random.prototype.nextGaussian = function()
{
	var u = this.nextFloat(), v = this.nextFloat();
	return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

Random.prototype.nextInt = function(z)
{ return (this.nextFloat() * z)|0; }

Random.prototype.nextIntRange = function(a, b)
{ return a + this.nextInt(b - a); }

Random.prototype.from = function(arr)
{ return arr[this.nextInt(arr.length)]; }

Random.prototype.fromWeighted = function(arr)
{
	if (!arr._weight)
	{
		arr._weight = 0;
		for (var i = 0; i < arr.length; ++i)
			arr._weight += arr[i].weight || 1;
	}

	var x = this.nextFloat() * arr._weight;
	for (var i = 0; i < arr.length; ++i)
		if ((x -= arr[i].weight || 1) < 0.0) return arr[i];
	return arr[0];
}

Random.prototype.draw = function(arr)
{
	var which = this.nextInt(arr.length);
	return arr.splice(which, 1)[0];
}

Array.prototype.shuffle = function(random)
{
	if (!random) random = new Random();
	for (var t, i = 1, j; i < this.length; ++i)
	{
		j = random.nextInt(i);
		t = this[j]; this[j] = this[i]; this[i] = t;
	}

	return this;
}

Array.prototype.contains = function(x)
{ return this.indexOf(x) != -1; }

Array.prototype.uniq = function()
{ return this.filter(function(a){ return !this[a] ? this[a] = true : false; }, {}); }

function __range(n)
{
	for (var x = [], i = 0; i < n; ++i) x.push(i);
	return x;
}

Number.prototype.toBin = function(p)
{
	var s = p || 'b#', x = (this & 0xFF);
	for (var i = 0x80; i > 0; i >>= 1)
		s += (x & i) ? '1' : '0';
	return s;
}

Number.prototype.toHex = function(n, p)
{
	var hex = this.toString(16);
	while (hex.length < n) hex = '0' + hex;
	return (p != null ? p : '') + hex;
}

Number.prototype.toPrintHex = function(n)
{ return '0x' + this.toHex(n).toUpperCase(); }

function ROMLogger(rom)
{ this.rom = rom; }

ROMLogger.prototype.start = function()
{
	this.orig = new Uint8Array(this.rom.byteLength);
	this.orig.set(this.rom);
	return this;
}

ROMLogger.prototype.print = function()
{
	for (var i = 0; i < this.rom.length; ++i)
	{
		if (this.rom[i] == this.orig[i]) continue;
		console.log(i.toHex(6, '0x') + ' - ' + this.orig[i].toHex(2) + '->' + this.rom[i].toHex(2));
	}
}

var makeCRCTable = function(){
    var c;
    var crcTable = [];
    for(var n =0; n < 256; n++){
        c = n;
        for(var k =0; k < 8; k++){
            c = ((c&1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1));
        }
        crcTable[n] = c;
    }
    return crcTable;
}

var CRC_TABLE = [];
for (var i = 0; i < 256; ++i)
{
	var c = i;
	for (var j = 0; j < 8; ++j)
		c = ((c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1));
	CRC_TABLE[i] = c;
}

function crc32(arr)
{
    var crc = 0 ^ (-1);
    for (var i = 0; i < arr.length; ++i)
        crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ arr[i]) & 0xFF];
    return (crc ^ (-1)) >>> 0;
}

$(document).ready(function()
{
	// use RANDOMIZER if language is set to en_US
	var language = window.navigator.userLanguage || window.navigator.language || "";
	EN_US = (language.indexOf('US') != -1);

	if (!EN_US) document.title = document.title.replace('ize', 'ise');
	$('[data-en_gb]').each(function()
	{
		var s = $(this);
		s.text(EN_US ? s.attr('data-en_us') : s.attr('data-en_gb'));
	});
});

var TESTERS =
{
	'Akisto': 'se7endeadlysins',
	'LiamPiper': 'liampiper',
	'Bramz': 'mibramz',
	'daniplayerone': 'daniplayerone',
	'Skybilz': 'skybilz',
	'dotsarecool': 'dotsarecoolp',
	'truman': 'truman',
	'prawclaw': 'prawclaw',
	'Sweetyt': 'sweetyt',
	'yunakitten': 'yunakitten',
	'princessproto': 'protomagicalgirl',
	'radioactiverat': 'radioactive_rat',
	'rezephos': 'rezephos',
	'marc765': 'marc765',
	'seathorne': 'seathorne74',
	'stephen1704': 'stephen1704',
	'dodechehedron': 'dodechehedron',
	'GDF': 'greendeathflavor',
	'PangaeaPanga': 'pangaeapanga',
	'linkdeadx2': 'linkdeadx2',
	'Aetyate': 'aetyate',
	'patrick': 'patpower2013',
	'mgl': 'matthewgaminglive',
	'slashinfty': 'slashinfty',
}

$('#tester-list').html(
	$.map(TESTERS, function(twitch, name)
	{
		var str = twitch ? '<a href="http://twitch.tv/' + twitch + '">' + name + '</a>' : name;
		return '<span class="tester-' + name + '">' + str + '</span>';
	}).shuffle().join(', ')
);

$('.version-number').text(VERSION_STRING);

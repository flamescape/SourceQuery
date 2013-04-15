var dgram = require('dgram')
  , bp = require('bufferpack')
  ;

var Answer = function() {
    this.compressed = false;
	this.parts = [];
    this.partsfound = 0;
};

Answer.prototype.add = function(id, buffer) {
	var head = bp.unpack('<ibbh', buffer);
	if ((head[0] & 0x80000000) !== 0) {
		this.compressed = true;
	}
	this.totalpackets = head[1];
    this.partsfound++;
	this.parts[head[2]] = buffer;
};
Answer.prototype.isComplete = function() {
	return (this.partsfound == this.totalpackets);
};
Answer.prototype.assemble = function() {
	var combined = [];
	for (var i = 0; i < this.parts.length; i++) {
		var head = bp.unpack('<ibb', this.parts[i]);
        combined.push(this.parts[i].slice(head[2] == 1 ? 16 : 8));
	}
    var payload = Buffer.concat(combined).slice(4);
    if (this.compressed) {
        console.warn('COMPRESSION NOT SUPPORTED. PAYLOAD:', payload);
    }
    return payload;
};

var SQUnpacker = function(messageEmitter, timeout) {
    this.timeout = timeout || 1000;
	this.answers = {};
	this.messageEmitter = messageEmitter;
	this.messageEmitter.on('message', this.readMessage.bind(this));
}

SQUnpacker.prototype = Object.create(require('events').EventEmitter.prototype);

SQUnpacker.prototype.readMessage = function(buffer, remote){
    var that = this;
    
	var header = bp.unpack('<i', buffer)[0];
	buffer = buffer.slice(4);

	if (header == -1) {
		this.emit('message', buffer, remote);
		return;
	}
	
	if (header == -2) {
		var ansID = bp.unpack('<i', buffer)[0];
		var ans = this.answers[ansID];
		if (!ans) {
			ans = this.answers[ansID] = new Answer();
            setTimeout(function(){
                // ensure that answers are not stored forever - discard after a timeout period
                // this simply cleans up partial-responses
                delete that.answers[ansID];
            }, this.timeout);
		}
		ans.add(ansID, buffer);
		
		if (ans.isComplete()) {
			this.emit('message', ans.assemble(), remote);
			delete this.answers[ansID];
		}
	}
};

var SourceQuery = function(timeout){
    timeout = timeout || 1000;

    var sq = this;
    
    var ids = {
        A2S_INFO: 'T',
        S2A_INFO: 'I',
        
        A2S_SERVERQUERY_GETCHALLENGE: 'W',
        S2A_SERVERQUERY_GETCHALLENGE: 'A',
        
        A2S_PLAYER: 'U',
        S2A_PLAYER: 'D',
        
        A2S_RULES: 'V',
        S2A_RULES: 'E'
    };
    
    var send = function(buffer, responseCode, cb) {
        sq.client.send(buffer, 0, buffer.length, sq.port, sq.address, function(err, bytes){
            var giveUpTimer;
        
            if (err) {
                cb(err, null);
                return;
            }
            
            var relayResponse = function(buffer, remote){
                if (buffer.length < 1)
                    return;
                
                if (bp.unpack('<s', buffer)[0] !== responseCode)
                    return;
                
                sq.squnpacker.removeListener('message', relayResponse);
                clearTimeout(giveUpTimer);
                cb(null, buffer.slice(1));
            };
            
            giveUpTimer = setTimeout(function(){
                sq.squnpacker.removeListener('message', relayResponse);
                cb('timeout', null);
            }, timeout);
            
            sq.squnpacker.on('message', relayResponse);
        });
    };
    
    var combine = function(keys, values) {
        var pairs = {};
        for (var i = 0; i < values.length; i++) {
            pairs[keys[i]] = values[i];
        }
        return pairs;
    };

    sq.open = function(address, port, errorHandler) {
        sq.address = address;
        sq.port = port;
        sq.client = dgram.createSocket('udp4');
        sq.client.on('error', errorHandler || function(){});
        sq.squnpacker = new SQUnpacker(sq.client);
    };
    
    sq.getChallengeKey = function(reqType, cb) {
        send(bp.pack('<isi', [-1, reqType, -1]), ids.S2A_SERVERQUERY_GETCHALLENGE, function(err, buffer){
            if (err) {
                cb(err, buffer);
                return;
            }
            
            cb(null, bp.unpack('<i', buffer)[0]);
        });
    };
    
    sq.getInfo = function(cb) {
        send(bp.pack('<isS', [-1, ids.A2S_INFO, 'Source Engine Query']), ids.S2A_INFO, function(err, buffer){
            if (err) {
                cb(err, buffer);
                return;
            }
            
            var infoArray = bp.unpack('<bSSSShBBBssBB', buffer);
            var info = combine(
                ['protocol', 'name', 'map', 'folder', 'game', 'appid', 'players', 'maxplayers', 'bots', 'servertype', 'environment', 'password', 'vac'],
                infoArray
            );
            
            var offset = bp.calcLength('<bSSSShBBBssBB', infoArray);
            buffer = buffer.slice(offset);
            
            // if "The Ship"
            if (info.appid == 2400) {
                var shipInfo = combine(
                    ['ship-mode','ship-witnesses','ship-duration'],
                    bp.unpack('<bbb', buffer)
                );
                for (var i in shipInfo) {
                    info[i] = shipInfo[i];
                }
                buffer = buffer.slice(3);
            }
            
            info.version = bp.unpack('<S', buffer)[0];
            offset = bp.calcLength('<S', [info.version]);
            buffer = buffer.slice(offset);
            
            if (buffer.length > 1) {
                offset = 0;
                var EDF = bp.unpack('<b', buffer)[0];
                offset += 1;
                
                if ((EDF & 0x80) !== 0) {
                    info.port = bp.unpack('<h', buffer, offset)[0];
                    offset += 2;
                }
                
                if ((EDF & 0x10) !== 0) {
                    info.steamID = bp.unpack('<ii', buffer, offset)[0];
                    offset += 8;
                }
                
                if ((EDF & 0x40) !== 0) {
                    var tvinfo = bp.unpack('<hS', buffer, offset);
                    info['tv-port'] = tvinfo[0];
                    info['tv-name'] = tvinfo[1];
                    offset += bp.calcLength('<hS', tvinfo);
                }
                
                if ((EDF & 0x20) !== 0) {
                    info.keywords = bp.unpack('<S', buffer, offset)[0];
                    offset += bp.calcLength('<S', info.keywords);
                }
                
                if ((EDF & 0x01) !== 0) {
                    info.gameID = bp.unpack('<i', buffer, offset)[0];
                    offset += 4;
                }
            }
            
            cb(null, info);
        });
    };
    
    sq.getPlayers = function(cb) {
        sq.getChallengeKey(ids.A2S_PLAYER, function(err, key){
            if (err) {
                cb(err, key);
                return;
            }
        
            send(bp.pack('<isi', [-1, ids.A2S_PLAYER, key]), ids.S2A_PLAYER, function(err, buffer){
                if (err) {
                    cb(err, buffer);
                    return;
                }
            
                var playerCount = bp.unpack('<b', buffer)[0];
                var players = [];
                var offset = 1;
                for (var i = 0; i < playerCount; i++) {
                    var p = bp.unpack('<bSif', buffer, offset);
                    players.push(combine(
                        ['index', 'name', 'score', 'online'],
                        p
                    ));
                    offset += bp.calcLength('<bSif', p);
                }
                cb(null, players);
            });
        });
    };
    
    sq.getRules = function(cb) {
        sq.getChallengeKey(ids.A2S_RULES, function(err, key){
            if (err) {
                cb(err, key);
                return;
            }
        
            send(bp.pack('<isi', [-1, ids.A2S_RULES, key]), ids.S2A_RULES, function(err, buffer){
                if (err) {
                    cb(err, buffer);
                    return;
                }
            
                var ruleCount = bp.unpack('<h', buffer)[0];
                var rules = [];
                var offset = 2;
                for (var i = 0; i < ruleCount; i++) {
                    var r = bp.unpack('<SS', buffer, offset);
                    rules.push(combine(['name', 'value'], r));
                    offset += bp.calcLength('<SS', r);
                }
                cb(null, rules);
            });
        });
    };
    
    sq.close = function() {
        sq.client.close();
    };
};

module.exports = SourceQuery;

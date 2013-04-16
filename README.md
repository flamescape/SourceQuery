SourceQuery
===========

A Source Server Query protocol implementation for node.js

Protocol specification can be found here: https://developer.valvesoftware.com/wiki/Server_queries

Usage
-----

Install with npm:

    npm install sourcequery

Example usage:

```js
var SourceQuery = require('sourcequery');

var sq = new SourceQuery(1000); // 1000ms timeout
sq.open('87.106.131.249', 27015);

sq.getInfo(function(err, info){
    console.log('Server Info:', info);
});

sq.getPlayers(function(err, players){
    console.log('Online Players:', players);
});

sq.getRules(function(err, rules){
    console.log('Server Rules:', rules);
});

setTimeout(sq.close, 2000); // close the socket after a couple of seconds
```

Licence
-------
> Copyright (c) 2013, Gareth Hughes
> All rights reserved.
> 
> Redistribution and use in source and binary forms, with or without
> modification, are permitted provided that the following conditions are met: 
> 
> 1. Redistributions of source code must retain the above copyright notice, this
>    list of conditions and the following disclaimer. 
> 2. Redistributions in binary form must reproduce the above copyright notice,
>    this list of conditions and the following disclaimer in the documentation
>    and/or other materials provided with the distribution. 
> 
> THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
> ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
> WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
> DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT OWNER OR CONTRIBUTORS BE LIABLE FOR
> ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
> (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
> LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND
> ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
> (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
> SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.

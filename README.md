SourceQuery
===========

A Source Server Query protocol implementation for node.js

Protocol specification can be found here: https://developer.valvesoftware.com/wiki/Server_queries

Example Usage
=============

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
```

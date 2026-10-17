const fs=require('fs');
const src=fs.readFileSync(__dirname+'/deep_overflow.js','utf8').replace("const pages = fs.readdirSync(ROOT).filter(f => f.endsWith('.html') && !SKIP.test(f)).sort();","const pages = process.argv.slice(2);").replace("__dirname + '/deep_overflow.json'","__dirname + '/deep_one.json'");
fs.writeFileSync(__dirname+'/_deep_tmp.js',src);

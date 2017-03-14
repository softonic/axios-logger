# @softonic/axios-logger

Axios plugin to log all requests and responses

## Installation

```bash
npm install @softonic/axios-logger
```

## Usage

```js
// CommonJS
// const axiosLogger = require('@softonic/axios-logger');

// ES2015
import axiosLogger from '@softonic/axios-logger';

axiosLogger(axiosInstance, {
  logger: bunyan.createLogger({ name: "myapp" }),
  // whitelistHeaders and blacklistHeaders should not be used together
  whitelistRequestHeaders: [ 'host', 'accept' ],
  whitelistResponseHeaders: [ 'content-type' ],
  blacklistRequestHeaders: [ 'authorization', 'cookie' ],
  blacklistResponseHeaders: [ 'set-cookie' ],
});
```

## Testing

Clone the repository and execute:

```bash
npm test
```

## Contribute

1. Fork it: `git clone https://github.com/softonic/@softonic/axios-logger.git`
2. Create your feature branch: `git checkout -b feature/my-new-feature`
3. Commit your changes: `git commit -am 'Added some feature'`
4. Check the build: `npm run build`
4. Push to the branch: `git push origin my-new-feature`
5. Submit a pull request :D

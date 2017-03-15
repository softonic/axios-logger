import URL from 'url';
import { formatRequest, formatResponse } from '@softonic/http-log-format';
import { pick, omit } from 'lodash';

/**
 * Filters the given headers object picking the given whitelisted headers (if any) and removing
 * all blacklisted ones
 * @param  {Object.<string, string>} options.headers
 * @param  {string[]} [options.whitelistHeaders]
 * @param  {string[]} [options.blacklistHeaders]
 * @return {Object.<string, string>}
 */
function filterHeaders({ headers, whitelistHeaders, blacklistHeaders }) {
  const whitelistedHeaders = whitelistHeaders ? pick(headers, whitelistHeaders) : headers;
  return omit(whitelistedHeaders, blacklistHeaders);
}

/**
 * @param  {axios.Response} options.axiosResponse
 * @param  {string[]} [options.whitelistRequestHeaders]
 * @param  {string[]} [options.blacklistRequestHeaders]
 * @return {http.ClientRequest}
 */
function getLoggableRequestFromAxiosResponse({
  axiosResponse,
  whitelistRequestHeaders,
  blacklistRequestHeaders,
}) {
  const timestamp = axiosResponse.config.timestamp;
  const nativeRequest = Object.assign({ timestamp }, axiosResponse.request);

  const loggableRequest = formatRequest(nativeRequest);
  loggableRequest.headers = filterHeaders({
    headers: loggableRequest.headers,
    whitelistHeaders: whitelistRequestHeaders,
    blacklistHeaders: blacklistRequestHeaders,
  });

  return loggableRequest;
}

/**
 * @param  {Object} options.axiosConfig
 * @param  {string[]} [options.whitelistRequestHeaders]
 * @param  {string[]} [options.blacklistRequestHeaders]
 * @return {http.ClientRequest}
 */
function getLoggableRequestFromAxiosConfig({
  axiosConfig,
  whitelistRequestHeaders,
  blacklistRequestHeaders,
}) {
  const { timestamp, headers } = axiosConfig;
  const parsedUrl = URL.parse(axiosConfig.url);
  const allHeaders = Object.assign({ host: parsedUrl.host }, headers);

  return {
    timestamp,
    method: axiosConfig.method.toUpperCase(),
    url: parsedUrl.path,
    headers: filterHeaders(allHeaders, {
      whitelistHeaders: whitelistRequestHeaders,
      blacklistHeaders: blacklistRequestHeaders,
    }),
  };
}

/*
 * @param  {axios.Response} options.axiosResponse
 * @param  {string[]} [options.whitelistResponseHeaders]
 * @param  {string[]} [options.blacklistResponseHeaders]
 * @return {http.IncomingMessage}
 */
function getLoggableResponseFromAxiosResponse({
  axiosResponse,
  whitelistResponseHeaders,
  blacklistResponseHeaders,
}) {
  const requestTimestamp = axiosResponse.config.timestamp;
  const now = new Date();

  const pseudoNativeResponse = {
    timestamp: now.toISOString(),
    statusCode: axiosResponse.status,
    headers: axiosResponse.headers,
    responseTime: now - new Date(requestTimestamp).getTime(),
  };

  const loggableResponse = formatResponse(pseudoNativeResponse);
  loggableResponse.headers = filterHeaders({
    headers: loggableResponse.headers,
    whitelistHeaders: whitelistResponseHeaders,
    blacklistHeaders: blacklistResponseHeaders,
  });

  return loggableResponse;
}

/**
 * Returns a string with some information from the given request
 * E.g.: 'GET example.com/test'
 * @param  {http.ClientRequest} request
 * @return {string}
 */
function makeRequestLine(request) {
  /* eslint-disable no-underscore-dangle */
  const headers = request.headers || request._headers || {};
  /* eslint-enable no-underscore-dangle */
  const host = headers.host || '';
  const url = request.url || request.path;
  return `${request.method} ${host}${url}`;
}

/**
 * Sets up interceptors to log requests and responses/errors in the given axios instance
 * @param  {axios.Axios} axios [description]
 * @param  {Object} options
 * @param  {Logger} options.logger
 */
export default function axiosBunyan(axios, {
  logger,
  whitelistRequestHeaders,
  blacklistRequestHeaders,
  whitelistResponseHeaders,
  blacklistResponseHeaders,
}) {
  const logRequest = (config) => {
    // eslint-disable-next-line no-param-reassign
    config.timestamp = new Date().toISOString();
    return config;
  };

  const logResponse = (axiosResponse) => {
    const request = getLoggableRequestFromAxiosResponse({
      axiosResponse,
      whitelistRequestHeaders,
      blacklistRequestHeaders,
    });

    const response = getLoggableResponseFromAxiosResponse({
      axiosResponse,
      whitelistResponseHeaders,
      blacklistResponseHeaders,
    });
    const requestLine = makeRequestLine(request);

    logger.info({
      request,
      response,
    }, `${requestLine} ${response.statusCode}`);

    return axiosResponse;
  };

  const logError = (error) => {
    let request;
    if (error.response) {
      request = getLoggableRequestFromAxiosResponse({
        axiosResponse: error.response,
        whitelistRequestHeaders,
        blacklistRequestHeaders,
      });
    } else if (error.config) {
      request = getLoggableRequestFromAxiosConfig({
        axiosConfig: error.config,
        whitelistRequestHeaders,
        blacklistRequestHeaders,
      });
    }

    const requestLine = request ? makeRequestLine(request) : 'Undefined client request';

    if (error.response) {
      const response = getLoggableResponseFromAxiosResponse({
        axiosResponse: error.response,
        whitelistResponseHeaders,
        blacklistResponseHeaders,
      });
      logger.error({
        request,
        response,
      }, `${requestLine} ${response.statusCode}`);
    } else {
      logger.error({
        request,
        error,
      }, `${requestLine} ERROR`);
    }

    return Promise.reject(error);
  };

  axios.interceptors.request.use(logRequest);
  axios.interceptors.response.use(logResponse, logError);
}

import URL from 'url';
import {
  formatRequest,
  formatResponse,
  stringifyRequest,
  stringifyResponse,
} from '@softonic/http-log-format';

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

  const loggableRequest = formatRequest(nativeRequest, {
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

  const pseudoNativeRequest = {
    timestamp,
    method: axiosConfig.method.toUpperCase(),
    url: parsedUrl.path,
    headers: allHeaders,
  };

  const loggableRequest = formatRequest(pseudoNativeRequest, {
    whitelistHeaders: whitelistRequestHeaders,
    blacklistHeaders: blacklistRequestHeaders,
  });

  return loggableRequest;
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

  const loggableResponse = formatResponse(pseudoNativeResponse, {
    whitelistHeaders: whitelistResponseHeaders,
    blacklistHeaders: blacklistResponseHeaders,
  });

  return loggableResponse;
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

    const message = `${stringifyRequest(request)} ${stringifyResponse(response)}`;

    logger.info({
      request,
      response,
    }, message);

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
    } else {
      request = { headers: {} };
    }

    if (error.response) {
      const response = getLoggableResponseFromAxiosResponse({
        axiosResponse: error.response,
        whitelistResponseHeaders,
        blacklistResponseHeaders,
      });
      const message = `${stringifyRequest(request)} ${stringifyResponse(response)}}`;
      logger.error({
        request,
        response,
      }, message);
    } else {
      const message = `${stringifyRequest(request)} ERROR`;
      logger.error({
        request,
        error,
      }, message);
    }

    return Promise.reject(error);
  };

  axios.interceptors.request.use(logRequest);
  axios.interceptors.response.use(logResponse, logError);
}

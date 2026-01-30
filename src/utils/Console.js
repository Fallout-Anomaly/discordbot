require('colors');
const fs = require('fs');
const path = require('path');

const LOG_FILE = process.env.LOG_FILE_PATH || path.join(process.cwd(), 'terminal.log');

/**
 * Generic log function to handle both console output and file appending
 * @param {string} type - Check specific log type (Info, OK, Error, Warning) 
 * @param {string[]} messages 
 * @param {string} colorMethod - colors method name
 */
const logOutput = (type, colorMethod, messages) => {
    const time = new Date().toLocaleTimeString();
    const msgString = messages.join(' ');
    
    // Console output
    let logLabel = `[${type}]`;
    if (colorMethod && logLabel[colorMethod]) {
        logLabel = logLabel[colorMethod];
    }
    
    // Choose console method
    const consoleMethod = (type === 'Error') ? console.error : (type === 'Warning') ? console.warn : console.log;
    
    // Check if any message is an Error object and log it nicely
    const hasError = messages.some(m => m instanceof Error);
    if (hasError) {
         consoleMethod(`[${time}]`.gray, logLabel, ...messages);
    } else {
         consoleMethod(`[${time}]`.gray, logLabel, msgString);
    }

    // File output (Async, non-blocking)
    // Strip ansi codes for file
    const fileLine = `[${time}] [${type}] ${msgString}\n`;
    
    fs.appendFile(LOG_FILE, fileLine, (err) => {
        if (err) console.error("Failed to write to log file:", err.message);
    });
};

const info = (...message) => logOutput('Info', 'blue', message);
const success = (...message) => logOutput('OK', 'green', message);
const error = (...message) => logOutput('Error', 'red', message);
const warn = (...message) => logOutput('Warning', 'yellow', message);

module.exports = { info, success, error, warn };
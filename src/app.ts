import compression from 'compression';
import express from 'express';
import morgan from 'morgan';
import { getBrowser } from './browser.js';
import { renderPdf, renderImage } from './render.js';

const app = express();

// In production it will probably service behind a proxy
app.enable('trust proxy');

// hide information about express
app.disable('x-powered-by');

// enable compression
app.use(compression());

// and json parsing
const bodyLimit = process.env.BODY_LIMIT || '100kb';
app.use(express.json({ limit: bodyLimit }));

// enable logs
app.use(morgan(process.env.NODE_ENV === 'production' ? 'tiny' : 'dev'));

// liveness probe
app.get('/.live', async (req, res, next) => {
    try {
        // get the browser instance
        const browser = await getBrowser();

        // ensure it's alive and throw if it's not
        if (!browser.isConnected()) {
            throw new Error('Browser disconnected');
        }

        // give a successful answer
        res.status(200).send('OK');
    } catch (error) {
        // continue with the error
        next(error);
    }
});

// render pdf
const handleRender = (renderFunc, contentType) => async (req, res, next) => {
    try {
        const { html = '', options = null } = req.body;
        const result = await renderFunc(html, options);
        res.set('content-type', contentType);
        res.send(result);
    } catch (error) {
        next(error);
    }
};

app.post('/image', handleRender(renderImage, 'image/jpeg'));
app.post('/pdf', handleRender(renderPdf, 'application/pdf'));
app.post('/', handleRender(renderPdf, 'application/pdf'));

// error handler
app.use((error, req, res, next) => {
    // print the error
    console.error(`Error when processing request: ${error.message}`);
    console.error(error.stack);

    // then returns a 500
    res.status(500).send('Internal Error');
});

export default app;

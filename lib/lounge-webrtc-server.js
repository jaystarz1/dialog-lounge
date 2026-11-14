// private-quest-lounge: one shared set of media ports per mediasoup worker.
//
// Without this every WebRtcTransport binds its own port per announced address
// (public + LAN = 2), every peer has two transports, and the pool is the 32
// ports the lounge publishes and forwards (40000-40031): the ninth peer, or
// fewer with test clients and a TV feeder around, got "no more available
// ports" and could not join voice (reproduced 2026-11-14 with
// tests/voice-ports.cjs in the lounge repo).
//
// A WebRtcServer listens once and every transport of that worker shares it:
// worker i takes port MIN+2i for the public address and MIN+2i+1 for the LAN
// address, UDP and TCP. Transports then take no ports at all.
// Only in public mode (MEDIASOUP_ANNOUNCED_IP set); a worker that does not fit
// in the range, or whose server cannot start, keeps the old per-transport way.
const Logger = require('./Logger');

const logger = new Logger('lounge-webrtc-server');
const byWorker = new Map();
const byRouter = new WeakMap();

async function attach(worker, index, config)
{
	const publicIp = process.env.MEDIASOUP_ANNOUNCED_IP;
	const lanIp = process.env.MEDIASOUP_ANNOUNCED_IP_LAN;

	if (!publicIp) return null;

	const min = Number(config.mediasoup.workerSettings.rtcMinPort);
	const max = Number(config.mediasoup.workerSettings.rtcMaxPort);
	const perWorker = lanIp ? 2 : 1;
	const port = min + (index * perWorker);

	if (port + perWorker - 1 > max)
	{
		logger.warn('worker %d has no room in %d-%d for a shared port; it keeps per-transport ports', index, min, max);

		return null;
	}

	const listenInfos = [];

	for (const protocol of [ 'udp', 'tcp' ])
	{
		listenInfos.push({ protocol, ip: '0.0.0.0', announcedIp: publicIp, port });
		if (lanIp) listenInfos.push({ protocol, ip: '0.0.0.0', announcedIp: lanIp, port: port + 1 });
	}

	try
	{
		const server = await worker.createWebRtcServer({ listenInfos });

		byWorker.set(worker, server);
		logger.info('worker %d shares media port(s) %d-%d', index, port, port + perWorker - 1);

		return server;
	}
	catch (error)
	{
		logger.error('worker %d shared media port failed (%s); it keeps per-transport ports', index, error.message);

		return null;
	}
}

// Remember which worker a router lives on.
function register(router, worker)
{
	const server = byWorker.get(worker);

	if (server) byRouter.set(router, server);
}

// Transport options for a router: on the shared server when it has one.
function transportOptions(router, options)
{
	const server = byRouter.get(router);

	if (!server) return options;

	const { listenIps, ...rest } = options; // eslint-disable-line no-unused-vars

	return { ...rest, webRtcServer: server };
}

module.exports = { attach, register, transportOptions };

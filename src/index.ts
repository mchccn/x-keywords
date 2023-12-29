import next from "@fastify/nextjs";
import { PrismaClient } from "@prisma/client";
import "dotenv/config";
import fastify, { FastifyRequest } from "fastify";
import { readFile } from "fs/promises";
import { Client } from "twitter-api-sdk";
import { fetchRecentTweetCounts } from "./fetch.js";

const ONE_HOUR = 1000 * 60 * 60;

type ReqWithQuery<T> = FastifyRequest<{ Querystring: T }>;

const client = new Client(process.env.TWITTER_BEARER_TOKEN!);
const prisma = new PrismaClient();

const app = fastify();

app.register(next, { dev: process.env.NODE_ENV === "development" }).then(() => app.next("/"));

const KEYWORDS = (await readFile("keywords.txt", "utf8")).split("\n");
const MOVING_AVERAGE_WINDOW = Number(process.env.MOVING_AVERAGE_WINDOW ?? 5);
const SPIKE_THRESHOLD = Number(process.env.SPIKE_THRESHOLD ?? 1.25);
const MIN_DIFF = Number(process.env.MIN_DIFF ?? -Infinity);

app.get("/api/config", async (req, res) => {
    return res.send({ KEYWORDS, MOVING_AVERAGE_WINDOW });
});

app.get("/api/delete", async (req, res) => {
    const { authorization } = req.headers;

    if (authorization !== `Bearer ${process.env.API_SECRET_KEY}`)
        return res.status(401).send({ statusCode: 401, error: "unauthorized" });

    // delete data that is more than 3 weeks old
    await prisma.interval.deleteMany({ where: { end: { lte: new Date(Date.now() - ONE_HOUR * 24 * 7 * 3) } } });

    return res.send({ statusCode: 200, updated: true });
});

app.get("/api/update", async (req: ReqWithQuery<{ time?: string }>, res) => {
    const { authorization } = req.headers;

    if (authorization !== `Bearer ${process.env.API_SECRET_KEY}`)
        return res.status(401).send({ statusCode: 401, error: "unauthorized" });

    console.log("FETCHING TWEETS AT", new Date().toLocaleString());

    const tweets = await fetchRecentTweetCounts(client, KEYWORDS, Number(req.query.time ?? ONE_HOUR));

    const entries = Object.entries(tweets)
        .flatMap(([keyword, tweets]) => tweets.map(({ end, tweet_count: count }) => ({ end, keyword, count })))
        .map((data) => prisma.interval.create({ data }));

    await Promise.allSettled(entries);

    console.log("TWEETS SAVED AT", new Date().toLocaleString());

    return res.send({ statusCode: 200, updated: true });
});

app.get("/api/fetch", async (req: ReqWithQuery<{ keyword?: string; time?: string }>, res) => {
    const data = await prisma.interval.findMany({
        where: {
            keyword: { equals: req.query.keyword, mode: "insensitive" },
            end: { gte: new Date(Date.now() - Number(req.query.time ?? ONE_HOUR) - ONE_HOUR) },
        },
        orderBy: { end: "asc" },
    });

    return res.status(200).send(data);
});

app.get("/api/spikes", async (req, res) => {
    const spikes: { keyword: string; difference: number; percent: number }[] = [];

    for (const keyword of KEYWORDS) {
        const data = await prisma.interval.findMany({
            where: { keyword },
            orderBy: { end: "desc" },
            take: MOVING_AVERAGE_WINDOW + 1,
        });

        const now = data.slice(0, MOVING_AVERAGE_WINDOW);
        const then = data.slice(1, MOVING_AVERAGE_WINDOW + 1);

        const nowMA = now.reduce((a, b) => a + b.count, 0) / now.length;
        const thenMA = then.reduce((a, b) => a + b.count, 0) / then.length;

        if (nowMA > thenMA * SPIKE_THRESHOLD && nowMA - thenMA > MIN_DIFF)
            spikes.push({ keyword, difference: nowMA - thenMA, percent: nowMA / thenMA - 1 });
    }

    return res.send(spikes);
});

await app.listen({ port: Number(process.env.PORT ?? 3000) }).then((address) => console.log("LISTENING AT", address));

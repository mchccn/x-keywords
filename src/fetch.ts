import type { Client, types } from "twitter-api-sdk";

export async function fetchRecentTweetCounts(client: Client, keywords: string[], latest = 1000 * 60 * 60) {
    if (latest < 1000 * 60 * 60) throw new RangeError("latest time cannot be less than an hour");
    if (latest > 1000 * 60 * 60 * 24 * 7) throw new RangeError("lastest time cannot be greater than a week");

    type TweetCount = NonNullable<
        types.operations["tweetCountsRecentSearch"]["responses"][200]["content"]["application/json"]["data"]
    >[number];

    const result: Record<string, TweetCount[]> = {};

    try {
        for (const keyword of keywords) {
            const tweets: TweetCount[] = [];

            try {
                console.log("FETCHING", keyword);

                const delay = (delay: number) => new Promise((resolve) => setTimeout(resolve, delay));

                let next_token: string | undefined;

                do {
                    console.log("FETCHING TOKEN", next_token);

                    const end = new Date();

                    end.setMinutes(0, 0, 0);

                    if (Date.now() - end.getTime() < 1000 * 10) end.setHours(end.getHours() - 1);

                    const results = await client.tweets.tweetCountsRecentSearch({
                        query: `(#${keyword} OR ${keyword}) (lang:en OR lang:zh-CN) -is:retweet -is:reply`,
                        start_time: new Date(Date.now() - latest).toISOString(),
                        end_time: end.toISOString(),
                        granularity: "hour",
                        next_token,
                    });

                    // no data, uh oh
                    if (!results.data) {
                        console.error("FAILED TO RETRIEVE TWEETS:", results.errors);

                        break;
                    }

                    tweets.push(...(results.data ?? []));

                    // store next_token for next iteration
                    next_token = results.meta?.next_token;

                    // avoid being ratelimited
                    await delay(5000);
                } while (typeof next_token === "string");

            } catch (error) {
                //@ts-ignore
                console.error("ERROR FETCHING TWEETS:", error.message, error.error?.errors);
            } finally {
                result[keyword] = tweets;
            }
        }
    } catch (error) {
        //@ts-ignore
        console.error("ERROR FETCHING TWEETS:", error.message, error.error?.errors);
    } finally {
        console.log("DONE FETCHING TWEETS");

        return result;
    }
}

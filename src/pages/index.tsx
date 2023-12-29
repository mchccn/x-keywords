import { Chart } from "@/src/components/Chart";
import { UTCTimestamp } from "lightweight-charts";
import Head from "next/head";
import { useState } from "react";
import Autocomplete from "react-autocomplete";
import { UseQueryResult, useQuery } from "react-query";

export default function Index() {
    const {
        isLoading: configIsLoading,
        isError: configIsError,
        data: config,
    } = useQuery<{ KEYWORDS: string[]; MOVING_AVERAGE_WINDOW: number }>("config", () =>
        fetch("/api/config").then((res) => res.json()),
    );

    const [keyword, setKeyword] = useState("");
    const [showCount, setShowCount] = useState(true);
    const [showMovingAverage, setShowMovingAverage] = useState(true);

    const {
        isLoading: spikesIsLoading,
        isError: spikesIsError,
        data: spikes,
    }: UseQueryResult<{ keyword: string; difference: number; percent: number }[]> = useQuery("spikes", () =>
        fetch("/api/spikes").then((res) => res.json()),
    );

    const {
        isLoading: dataIsLoading,
        isError: dataIsError,
        data: data,
    }: UseQueryResult<{ id: number; end: string; keyword: string; count: number }[]> = useQuery(["data", keyword], {
        queryFn: () => fetch(`/api/fetch?keyword=${keyword}&time=${1000 * 60 * 60 * 24 * 7}`).then((res) => res.json()),
        enabled: (config?.KEYWORDS ?? []).map((item) => item.toLowerCase()).includes(keyword.toLowerCase()),
    });

    if (configIsLoading) return <div>loading config</div>;

    if (configIsError) return <div>error loading config</div>;

    console.log(spikes);

    return (
        <>
            <Head>
                <meta charSet="UTF-8" />
                <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
                <meta name="viewport" content="width=device-width, initial-scale=1.0" />
                <title>TWITTER_KEYWORDS</title>
            </Head>
            <div className="root">
                {spikesIsLoading && <p>loading spikes</p>}
                {spikesIsError && <p>loading spikes</p>}
                {spikes && (
                    <div>
                        <h1>increases</h1>
                        <div className="grid">
                            {spikes
                                .sort((a, b) => b.difference - a.difference)
                                .map((up) => (
                                    <div key={up.keyword}>
                                        <p>
                                            {up.keyword}{" "}
                                            <span style={{ color: "green" }}>
                                                +{up.difference.toFixed(2)} (+{(up.percent * 100).toFixed(2)}%)
                                            </span>
                                        </p>
                                    </div>
                                ))}
                        </div>
                    </div>
                )}
                <div className="form">
                    <Autocomplete
                        getItemValue={(item) => item}
                        items={config?.KEYWORDS ?? []}
                        shouldItemRender={(item) => item.toLowerCase().indexOf(keyword.toLowerCase()) > -1}
                        renderItem={(item, isHighlighted) => (
                            <div key={item} style={{ background: isHighlighted ? "lightgray" : "white" }}>
                                {item}
                            </div>
                        )}
                        value={keyword}
                        onChange={(e) => setKeyword(e.target.value)}
                        onSelect={(value) => setKeyword(value)}
                        autoHighlight={true}
                        selectOnBlur={true}
                    />
                    <label htmlFor="showCount">
                        <span>show count</span>
                        <input type="checkbox" checked={showCount} onChange={(e) => setShowCount(e.target.checked)} />
                    </label>
                    <label htmlFor="showMovingAverage">
                        <span>show moving average</span>
                        <input
                            type="checkbox"
                            checked={showMovingAverage}
                            onChange={(e) => setShowMovingAverage(e.target.checked)}
                        />
                    </label>
                </div>
                <div>
                    {dataIsLoading && <p>loading data</p>}
                    {dataIsError && <p>error loading data</p>}
                    {data && (
                        <Chart
                            line1={
                                showCount
                                    ? data.map((entry) => ({
                                          time: Math.floor(new Date(entry.end).getTime() / 1000) as UTCTimestamp,
                                          value: entry.count,
                                      }))
                                    : []
                            }
                            line2={
                                showMovingAverage
                                    ? data.slice(4).map((entry, i) => {
                                          const window = data
                                              .slice(i, i + (config?.MOVING_AVERAGE_WINDOW ?? 0) - 1)
                                              .concat(entry);

                                          return {
                                              time: Math.floor(new Date(entry.end).getTime() / 1000) as UTCTimestamp,
                                              value:
                                                  window.reduce((a, b) => a + b.count, 0) /
                                                  (config?.MOVING_AVERAGE_WINDOW ?? 1),
                                          };
                                      })
                                    : []
                            }
                        />
                    )}
                </div>
            </div>
        </>
    );
}

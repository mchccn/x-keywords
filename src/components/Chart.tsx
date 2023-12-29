import { BarPrice, ColorType, LineData, createChart } from "lightweight-charts";
import { useEffect, useRef } from "react";

export const Chart = (props: {
    line1: LineData[];
    line2: LineData[];
    colors?: {
        backgroundColor?: string;
        lineColor?: string;
        textColor?: string;
        areaTopColor?: string;
        areaBottomColor?: string;
    };
}) => {
    const { line1, line2, colors: {} = {} } = props;

    const chartContainerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleResize = () => {
            chart.applyOptions({ width: chartContainerRef.current!.clientWidth });
        };

        const chart = createChart(chartContainerRef.current!, {
            layout: {
                background: { type: ColorType.Solid, color: "white" },
                textColor: "black",
            },
            localization: { priceFormatter: (value: BarPrice) => Math.round(value) },
            width: chartContainerRef.current!.clientWidth,
            height: 300,
            timeScale: {
                timeVisible: true,
                secondsVisible: false,
                fixRightEdge: true,
            },
        });

        chart.timeScale().fitContent();

        chart.addLineSeries({ color: "#2097F3" }).setData(line1);
        chart.addLineSeries({ color: "#FA3234" }).setData(line2);

        window.addEventListener("resize", handleResize);

        return () => {
            window.removeEventListener("resize", handleResize);

            chart.remove();
        };
    }, [line1, line2]);

    return <div ref={chartContainerRef} />;
};

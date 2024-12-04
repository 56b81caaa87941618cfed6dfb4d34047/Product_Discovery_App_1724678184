import React from 'react';
import ReactECharts from 'echarts-for-react';
import chartConfig from './chart_config.json';

type EChartsOption = Record<string, any>;

interface ChartConfigFile {
    echart_config: EChartsOption;
    query_id: string;
    graph_type: string;
}

interface DataRecord {
    [key: string]: any;
}

const fetchDataset = async (queryId: string): Promise<DataRecord[]> => {
    const response = await fetch('https://api.spaceandtime.dev/v1/public/sql/content-queries', {
        method: 'POST',
        headers: {
            'accept': 'application/json',
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            queryId: queryId,
            biscuits: []
        })
    });

    if (!response.ok) {
        throw new Error(`API call failed: ${response.statusText}`);
    }

    const data = await response.json();
    return data;
};

const transformData = (
    dataset: DataRecord[],
    graphType: string,
    originalSeries: any[]
): { transformedData: DataRecord[]; newSeries: any[] } => {
    // Check if the graph type requires transformation
    if (graphType === 'stacked_area_chart' || graphType === 'stacked_line_chart' || graphType === 'stacked_column_chart') {
        if (!originalSeries?.[0]) {
            throw new Error('Original series configuration is required for stacked charts');
        }

        const seriesConfig = originalSeries[0];
        const xField = seriesConfig.x;
        const yField = seriesConfig.y;
        const categoryField = seriesConfig.category;

        // Pivot the data using the field names from series config
        const categories = [...new Set(dataset.map(item => item[categoryField]))];
        const xValues = [...new Set(dataset.map(item => item[xField]))];

        const pivotData: DataRecord[] = xValues.map(x => {
            const item: DataRecord = { [xField]: x };
            categories.forEach(category => {
                const found = dataset.find(d => 
                    d[xField] === x && d[categoryField] === category
                );
                item[category] = found ? found[yField] : 0;
            });
            return item;
        });

        const newSeries = categories.map(category => ({
            type: graphType === 'stacked_area_chart' || graphType === 'stacked_line_chart' ? 'line' : 'bar',
            ...(graphType === 'stacked_area_chart' || graphType === 'stacked_column_chart' ? { stack: 'all' } : {}),
            ...(graphType === 'stacked_area_chart' ? { areaStyle: {} } : {}),
            encode: {
                x: xField,
                y: category,
            },
            name: category,
        }));

        return { transformedData: pivotData, newSeries };
    } else {
        // No transformation needed
        return { transformedData: dataset, newSeries: originalSeries };
    }
};

const ChartComponent: React.FC = () => {
    const [options, setOptions] = React.useState<EChartsOption | null>(null);
    const [loading, setLoading] = React.useState<boolean>(true);
    const [error, setError] = React.useState<string | null>(null);

    React.useEffect(() => {
        const loadChartData = async () => {
            try {
                setLoading(true);
                setError(null);

                // Get the configuration and query ID from the JSON file
                const config = chartConfig as ChartConfigFile;

                // Fetch the dataset using the query ID
                const dataset = await fetchDataset(config.query_id);

                // Transform the data if needed
                const graphType = config.graph_type;
                const { transformedData, newSeries } = transformData(
                    dataset,
                    graphType,
                    config.echart_config.series || []
                );

                // Create a new options object combining the config with the transformed dataset
                const completeOptions = {
                    ...config.echart_config,
                    dataset: {
                        source: transformedData
                    },
                    series: newSeries
                };

                setOptions(completeOptions);
            } catch (error) {
                console.error('Error loading chart:', error);
                setError('Failed to load chart data');
            } finally {
                setLoading(false);
            }
        };

        loadChartData();
    }, []);

    if (loading) {
        return (
            <div className="w-full h-64 flex items-center justify-center">
                Loading chart...
            </div>
        );
    }

    if (error) {
        return (
            <div className="w-full h-64 flex items-center justify-center text-red-500">
                {error}
            </div>
        );
    }

    if (!options) {
        return (
            <div className="w-full h-64 flex items-center justify-center">
                No chart configuration available
            </div>
        );
    }

    return (
        <div className="w-full h-full bg-blue-500">
            <ReactECharts
                option={options}
                style={{ height: '400px', width: '100%' }}
                opts={{ renderer: 'canvas' }}
                notMerge={true}
                lazyUpdate={true}
            />
        </div>
    );
};

export { ChartComponent as component };

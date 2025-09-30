import * as React from "react";
import * as RechartsPrimitive from "recharts";

import { cn } from "~/libs/utils";
const THEMES = { light: "", dark: ".dark" } as const;

export type ChartConfig = {
  [k in string]: {
    label?: React.ReactNode;
    icon?: React.ComponentType;
  } & (
    | { color?: string; theme?: never }
    | { color?: never; theme: Record<keyof typeof THEMES, string> }
  );
};

type ChartContextProps = {
  config: ChartConfig;
};

const ChartContext = React.createContext<ChartContextProps | null>(null);

function useChart() {
  const context = React.useContext(ChartContext);
  if (!context)
    throw new Error("useChart must be used within a <ChartContainer />");
  return context;
}

function ChartContainer({
  id,
  className,
  children,
  config,
  ...props
}: React.ComponentProps<"div"> & {
  config: ChartConfig;
  children: React.ComponentProps<
    typeof RechartsPrimitive.ResponsiveContainer
  >["children"];
}) {
  const uniqueId = React.useId();
  const chartId = `chart-${id || uniqueId.replace(/:/g, "")}`;

  return (
    <ChartContext.Provider value={{ config }}>
      <div
        data-slot="chart"
        data-chart={chartId}
        className={cn(
          "[&_.recharts-cartesian-axis-tick_text]:fill-muted-foreground [&_.recharts-cartesian-grid_line[stroke='#ccc']]:stroke-border/50 [&_.recharts-curve.recharts-tooltip-cursor]:stroke-border [&_.recharts-polar-grid_[stroke='#ccc']]:stroke-border [&_.recharts-radial-bar-background-sector]:fill-muted [&_.recharts-rectangle.recharts-tooltip-cursor]:fill-muted [&_.recharts-reference-line_[stroke='#ccc']]:stroke-border flex aspect-video justify-center text-xs [&_.recharts-dot[stroke='#fff']]:stroke-transparent [&_.recharts-layer]:outline-hidden [&_.recharts-sector]:outline-hidden [&_.recharts-sector[stroke='#fff']]:stroke-transparent [&_.recharts-surface]:outline-hidden",
          className,
        )}
        {...props}
      >
        <ChartStyle id={chartId} config={config} />
        <RechartsPrimitive.ResponsiveContainer>
          {children}
        </RechartsPrimitive.ResponsiveContainer>
      </div>
    </ChartContext.Provider>
  );
}

const ChartStyle = ({ id, config }: { id: string; config: ChartConfig }) => {
  const colorConfig = Object.entries(config).filter(
    ([, c]) => c.theme || c.color,
  );
  if (!colorConfig.length) return null;
  const css = Object.entries(THEMES)
    .map(([theme, prefix]) => {
      const body = colorConfig
        .map(([key, itemConfig]) => {
          const color =
            itemConfig.theme?.[theme as keyof typeof itemConfig.theme] ||
            itemConfig.color;
          return color ? `  --color-${key}: ${color};` : "";
        })
        .filter(Boolean)
        .join("\n");
      return `${prefix} [data-chart=${id}] {\n${body}\n}`;
    })
    .join("\n");

  return <style>{css}</style>;
};

const ChartTooltip = RechartsPrimitive.Tooltip;

type TooltipPayloadItem = {
  dataKey?: string | number;
  name?: string;
  value?: number | string;
  payload?: Record<string, unknown>;
  color?: string;
  [k: string]: unknown;
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function isTooltipPayloadItem(v: unknown): v is TooltipPayloadItem {
  if (!isRecord(v)) return false;
  // heuristics: tooltip items often have value or dataKey or payload
  return "value" in v || "dataKey" in v || "name" in v || "payload" in v;
}

function getKeyFromItem(item: unknown, labelKey?: string): string {
  if (labelKey) return labelKey;
  if (isTooltipPayloadItem(item)) {
    if (typeof item.dataKey === "string") return item.dataKey;
    if (typeof item.name === "string") return item.name;
  }
  return "value";
}

interface ChartTooltipContentProps {
  active?: boolean;
  payload?: TooltipPayloadItem[] | null;
  className?: string;
  indicator?: "dot" | "line" | "dashed";
  hideLabel?: boolean;
  hideIndicator?: boolean;
  label?: string | React.ReactNode;
  labelFormatter?: (
    value: React.ReactNode | undefined,
    payload?: TooltipPayloadItem[] | null,
  ) => React.ReactNode;
  labelClassName?: string;
  formatter?: (
    value: number | string | undefined,
    name?: string,
    item?: TooltipPayloadItem,
    index?: number,
    payload?: Record<string, unknown>,
  ) => React.ReactNode;
  color?: string;
  nameKey?: string;
  labelKey?: string;
}

function ChartTooltipContent(props: ChartTooltipContentProps) {
  const {
    active,
    payload = null,
    className,
    indicator = "dot",
    hideLabel = false,
    hideIndicator = false,
    label,
    labelFormatter,
    labelClassName,
    formatter,
    color,
    nameKey,
    labelKey,
  } = props;
  const { config } = useChart();

  const tooltipLabel = React.useMemo(() => {
    if (hideLabel || !payload?.length) return null;
    const [item] = payload;
    const key = getKeyFromItem(item, labelKey);
    const itemConfig = getPayloadConfigFromPayload(config, item, key);
    let value: React.ReactNode | undefined;
    if (!labelKey && typeof label === "string" && label in config) {
      // label is a key into config
      value = config[label].label ?? label;
    } else {
      value = itemConfig?.label;
    }
    if (labelFormatter)
      return (
        <div className={cn("font-medium", labelClassName)}>
          {labelFormatter(value, payload)}
        </div>
      );
    if (!value) return null;
    return <div className={cn("font-medium", labelClassName)}>{value}</div>;
  }, [
    label,
    labelFormatter,
    payload,
    hideLabel,
    labelClassName,
    config,
    labelKey,
  ]);

  if (!active || !payload?.length) return null;
  const nestLabel = payload.length === 1 && indicator !== "dot";

  return (
    <div
      className={cn(
        "border-border/50 bg-background grid min-w-[8rem] items-start gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs shadow-xl",
        className,
      )}
    >
      {!nestLabel ? tooltipLabel : null}
      <div className="grid gap-1.5">
        {payload.map((item, index) => {
          const key = getKeyFromItem(item, nameKey);
          const itemConfig = getPayloadConfigFromPayload(config, item, key);
          const indicatorColor =
            color ||
            (isRecord(item.payload) && typeof item.payload["fill"] === "string"
              ? item.payload["fill"]
              : undefined) ||
            (typeof item.color === "string" ? item.color : undefined);
          return (
            <div
              key={`${item.dataKey ?? index}`}
              className={cn(
                "[&>svg]:text-muted-foreground flex w-full flex-wrap items-stretch gap-2 [&>svg]:h-2.5 [&>svg]:w-2.5",
                indicator === "dot" && "items-center",
              )}
            >
              {formatter &&
              isTooltipPayloadItem(item) &&
              item.value !== undefined &&
              typeof item.name === "string" ? (
                formatter(
                  item.value as number | string | undefined,
                  item.name,
                  item,
                  index,
                  isRecord(item.payload) ? item.payload : undefined,
                )
              ) : (
                <>
                  {itemConfig?.icon ? (
                    <itemConfig.icon />
                  ) : (
                    !hideIndicator && (
                      <div
                        className={cn(
                          "shrink-0 rounded-[2px] border-(--color-border) bg-(--color-bg)",
                          {
                            "h-2.5 w-2.5": indicator === "dot",
                            "w-1": indicator === "line",
                            "w-0 border-[1.5px] border-dashed bg-transparent":
                              indicator === "dashed",
                            "my-0.5": nestLabel && indicator === "dashed",
                          },
                        )}
                        style={
                          {
                            "--color-bg": indicatorColor,
                            "--color-border": indicatorColor,
                          } as React.CSSProperties
                        }
                      />
                    )
                  )}
                  <div
                    className={cn(
                      "flex flex-1 justify-between leading-none",
                      nestLabel ? "items-end" : "items-center",
                    )}
                  >
                    <div className="grid gap-1.5">
                      {nestLabel ? tooltipLabel : null}
                      <span className="text-muted-foreground">
                        {itemConfig?.label ??
                          (isRecord(item) && typeof item.name === "string"
                            ? item.name
                            : undefined)}
                      </span>
                    </div>
                    {item.value !== undefined && (
                      <span className="text-foreground font-mono font-medium tabular-nums">
                        {(item.value ?? "").toLocaleString()}
                      </span>
                    )}
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

const ChartLegend = RechartsPrimitive.Legend;

interface ChartLegendItem {
  value?: string | number;
  dataKey?: string | number;
  color?: string;
  [k: string]: unknown;
}

interface ChartLegendContentProps {
  className?: string;
  hideIcon?: boolean;
  payload?: ChartLegendItem[] | null;
  verticalAlign?: "top" | "bottom";
  nameKey?: string;
}

function ChartLegendContent(props: ChartLegendContentProps) {
  const {
    className,
    hideIcon = false,
    payload,
    verticalAlign = "bottom",
    nameKey,
  } = props;
  const { config } = useChart();
  if (!payload?.length) return null;
  return (
    <div
      className={cn(
        "flex items-center justify-center gap-4",
        verticalAlign === "top" ? "pb-3" : "pt-3",
        className,
      )}
    >
      {payload.map((item) => {
        const key = `${nameKey || item.dataKey || "value"}`;
        const itemConfig = getPayloadConfigFromPayload(config, item, key);
        return (
          <div
            key={`${item.value ?? key}`}
            className={cn(
              "[&>svg]:text-muted-foreground flex items-center gap-1.5 [&>svg]:h-3 [&>svg]:w-3",
            )}
          >
            {itemConfig?.icon && !hideIcon ? (
              <itemConfig.icon />
            ) : (
              <div
                className="h-2 w-2 shrink-0 rounded-[2px]"
                style={{ backgroundColor: item.color }}
              />
            )}
            {itemConfig?.label}
          </div>
        );
      })}
    </div>
  );
}

function getPayloadConfigFromPayload(
  config: ChartConfig,
  payload: unknown,
  key: string,
): ChartConfig[string] | undefined {
  if (typeof payload !== "object" || payload === null) return undefined;
  const payloadObj = payload as Record<string, unknown>;
  const payloadPayload =
    "payload" in payloadObj &&
    typeof payloadObj.payload === "object" &&
    payloadObj.payload !== null
      ? (payloadObj.payload as Record<string, unknown>)
      : undefined;
  let configLabelKey: string = key;
  const v = payloadObj[key];
  if (typeof v === "string") configLabelKey = v;
  else if (payloadPayload) {
    const pv = payloadPayload[key];
    if (typeof pv === "string") configLabelKey = pv;
  }
  return configLabelKey in config ? config[configLabelKey] : config[key];
}

export {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartStyle,
  ChartTooltip,
  ChartTooltipContent,
};

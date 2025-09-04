import type { Schedule, ScheduleItem } from "../types/schedule";
import { DEFAULT_SCHEDULE } from "../utils/schedule-config";
import { getCurrentTimeMs, timeToMs } from "../utils/time-calculations";
import { Card, CardContent } from "../../../components/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../../components/table";
import { Badge } from "../../../components/badge";

interface ScheduleTableProps {
    schedule?: Schedule;
}

export const ScheduleTable = ({ schedule = DEFAULT_SCHEDULE }: ScheduleTableProps) => {
    const currentTimeMs = getCurrentTimeMs();

    const formatTime = (item: ScheduleItem) => {
        const { hours, minutes, seconds } = item.startTime;
        return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds
            .toString()
            .padStart(2, "0")}`;
    };

    const isCurrentItem = (item: ScheduleItem, index: number) => {
        const itemStartMs = timeToMs(item.startTime);
        const nextItemStartMs =
            index + 1 < schedule.items.length ? timeToMs(schedule.items[index + 1].startTime) : Infinity;

        return currentTimeMs >= itemStartMs && currentTimeMs < nextItemStartMs;
    };

    const getRowClass = (item: ScheduleItem, index: number) => {
        if (isCurrentItem(item, index)) {
            return item.type === "class" ? "bg-primary bg-opacity-20" : "bg-secondary bg-opacity-20";
        }
        return "";
    };

    const getTypeIcon = (type: string) => {
        return type === "class" ? "📚" : "☕";
    };

    return (
        <Card className="shadow-xl">
            <CardContent>
                <h2 className="text-center font-bold mb-4">📅 今日の時間割</h2>

                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>時刻</TableHead>
                                <TableHead>内容</TableHead>
                                <TableHead>種類</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {schedule.items.map((item, index) => (
                                <TableRow key={index} className={getRowClass(item, index)}>
                                    <TableCell className="font-mono">{formatTime(item)}</TableCell>
                                    <TableCell className="font-semibold">
                                        {isCurrentItem(item, index) && (
                                            <Badge className="mr-2" variant="default">
                                                NOW
                                            </Badge>
                                        )}
                                        {item.label}
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-2">
                                            <span>{getTypeIcon(item.type)}</span>
                                            <Badge variant={item.type === "class" ? "default" : "secondary"}>
                                                {item.type === "class" ? "授業" : "休憩"}
                                            </Badge>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
        </Card>
    );
};

/** Chart page placeholder — full implementation in plan 03-02. */
import { useParams } from "react-router-dom";

export default function ChartPage() {
  const { symbol } = useParams<{ symbol: string }>();
  return (
    <div className="flex flex-col h-full p-4">
      <h1 className="text-2xl font-bold text-foreground">{symbol ?? "Chart"}</h1>
      <div className="flex-1 flex items-center justify-center text-muted-foreground">
        <p>Chart loading...</p>
      </div>
    </div>
  );
}

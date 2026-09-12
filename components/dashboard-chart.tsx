"use client";

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

interface DashboardChartProps {
  data: { week: string; concluidas: number }[];
}

export default function DashboardChart({ data }: DashboardChartProps) {
  return (
    <ResponsiveContainer width="100%" height={250}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
        <XAxis
          dataKey="week"
          tick={{ fill: "rgba(0,0,0,0.4)", fontSize: 12 }}
          axisLine={{ stroke: "rgba(0,0,0,0.08)" }}
          tickLine={false}
        />
        <YAxis
          tick={{ fill: "rgba(0,0,0,0.4)", fontSize: 12 }}
          axisLine={{ stroke: "rgba(0,0,0,0.08)" }}
          tickLine={false}
          allowDecimals={false}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: "#ffffff",
            border: "1px solid rgba(0,0,0,0.08)",
            borderRadius: "8px",
            color: "#1c1c1e",
            fontSize: 12,
            boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
          }}
        />
        <Bar dataKey="concluidas" fill="#F85021" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

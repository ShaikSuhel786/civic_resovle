import * as React from "react";
import { GlassCalendar } from "@/components/ui/glass-calendar";

export default function GlassCalendarDemo() {
  const [selectedDate, setSelectedDate] = React.useState(new Date());
  
  // High-quality modern urban/civic gradient background image for the glass effect
  const backgroundImageUrl = "https://images.unsplash.com/photo-1579546929518-9e396f3cc809?auto=format&fit=crop&w=1920&q=80";

  return (
    <div 
      className="flex min-h-screen w-full items-center justify-center bg-cover bg-center p-4 bg-slate-900"
      style={{ backgroundImage: `url(${backgroundImageUrl})` }}
    >
      <GlassCalendar 
        selectedDate={selectedDate}
        onDateSelect={setSelectedDate}
        className="transform transition-transform duration-500 hover:scale-105"
      />
    </div>
  );
}


package com.theo.flow;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

/**
 * Packs the items of one week into lanes under the day numbers, the way the web calendar does:
 * longer items first, then earlier columns, and an item takes the first lane that is free for its days.
 * What does not fit in {@code maxLanes} is counted per day. No Android types, so plain JVM tests cover it.
 */
public final class WeekLanes {
    public static final class Bar {
        public final CalendarData.Event event;
        /** First column, 0 = Monday, and how many columns it covers within this week. */
        public final int col,span,lane;
        Bar(CalendarData.Event event,int col,int span,int lane){this.event=event;this.col=col;this.span=span;this.lane=lane;}
    }

    public final List<Bar> bars=new ArrayList<>();
    /** Per column, how many items did not fit. */
    public final int[] hidden=new int[7];

    public boolean anyHidden(){for(int count:hidden)if(count>0)return true;return false;}

    public static WeekLanes layout(List<CalendarData.Event> events,LocalDate week,int maxLanes){
        WeekLanes result=new WeekLanes();
        List<int[]> spans=new ArrayList<>();
        List<CalendarData.Event> touching=CalendarData.week(events,week);
        for(CalendarData.Event event:touching){
            int col=(int)Math.max(0,ChronoUnit.DAYS.between(week,event.start));
            int last=(int)Math.min(6,ChronoUnit.DAYS.between(week,event.end));
            spans.add(new int[]{touching.indexOf(event),col,last});
        }
        spans.sort(Comparator.<int[]>comparingInt(s->s[1])
            .thenComparingInt(s->-(s[2]-s[1]))
            .thenComparing(s->touching.get(s[0]).task?0:1)
            .thenComparing(s->touching.get(s[0]).title));
        int[] laneEnds=new int[Math.max(1,spans.size())];
        int lanes=0;
        for(int[] s:spans){
            int lane=-1;
            for(int i=0;i<lanes;i++)if(laneEnds[i]<s[1]){lane=i;break;}
            if(lane==-1)lane=lanes++;
            laneEnds[lane]=s[2];
            if(lane>=maxLanes){for(int c=s[1];c<=s[2];c++)result.hidden[c]++;}
            else result.bars.add(new Bar(touching.get(s[0]),s[1],s[2]-s[1]+1,lane));
        }
        return result;
    }
}

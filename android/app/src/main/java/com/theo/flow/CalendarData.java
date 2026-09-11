package com.theo.flow;

import org.json.JSONArray;
import org.json.JSONObject;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

/** Matches CalendarView: six Monday-first weeks, Todo + Task + Todo children, no trash/notes. */
public final class CalendarData {
    public static final class Event {
        public final String id,title;
        public final LocalDate start,end;
        public final boolean due,completed;
        Event(String id,String title,LocalDate start,LocalDate end,boolean due,boolean completed) {
            this.id=id;this.title=title;this.start=start;this.end=end;this.due=due;this.completed=completed;
        }
    }
    static String field(JSONObject o,String camel,String snake) {
        return o.isNull(camel)?o.optString(snake,""):o.optString(camel,"");
    }
    static boolean done(JSONObject o) {return o.optBoolean("completed")||o.optInt("completed",0)==1;}
    static Event event(JSONObject o,String fallback,String suffix) {
        try {
            String s=field(o,"startDate","start_date");
            LocalDate start=LocalDate.parse(s.isEmpty()?fallback:s);
            String due=field(o,"dueDate","due_date");
            LocalDate end=due.isEmpty()?start:LocalDate.parse(due);
            if(end.isBefore(start))end=start;
            return new Event(o.optString("id"),o.optString("title","제목 없음")+suffix,start,end,!due.isEmpty(),done(o));
        }catch(Exception e){return null;}
    }
    public static List<Event> parse(JSONArray array) {
        List<Event> events=new ArrayList<>();
        for(int i=0;i<array.length();i++) {
            JSONObject o=array.optJSONObject(i);
            if(o==null||!field(o,"deletedAt","deleted_at").isEmpty())continue;
            String type=o.optString("type");
            if(!type.equals("task")&&!type.equals("todo"))continue;
            Event parent=event(o,"","");
            if(parent==null)continue;
            events.add(parent);
            if(!type.equals("todo"))continue;
            JSONArray children=o.optJSONArray("subtasks");
            if(children==null)children=o.optJSONArray("subTodos");
            if(children!=null)for(int j=0;j<children.length();j++){
                JSONObject child=children.optJSONObject(j);
                if(child==null||!field(child,"deletedAt","deleted_at").isEmpty())continue;
                Event item=event(child,parent.start.toString()," · "+parent.title);
                if(item!=null)events.add(item);
            }
        }
        events.sort(Comparator.comparing((Event e)->e.start).thenComparing(e->e.id));
        return events;
    }
    public static LocalDate first(YearMonth month) {
        LocalDate day=month.atDay(1);
        return day.minusDays(day.getDayOfWeek().getValue()-1);
    }
    public static List<Event> week(List<Event> events,LocalDate first) {
        List<Event> out=new ArrayList<>();
        for(Event event:events)if(!event.end.isBefore(first)&&!event.start.isAfter(first.plusDays(6)))out.add(event);
        return out;
    }
}

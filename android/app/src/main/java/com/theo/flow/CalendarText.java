package com.theo.flow;

import java.time.LocalDate;
import java.time.format.TextStyle;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;

/** The words on the widget: what a screen reader says and how the agenda names a date. No Android types, so plain JVM tests cover it. */
public final class CalendarText {
    private CalendarText(){}

    /** A roomy widget (a Fold opened up) adds an agenda beside the month. */
    public static boolean isWide(int width,int height){return width>=520&&width>=height*0.9f;}

    static String weekday(LocalDate date){return date.getDayOfWeek().getDisplayName(TextStyle.SHORT,Locale.KOREAN);}
    static String shortDate(LocalDate date){return date.getMonthValue()+"/"+date.getDayOfMonth();}

    /** "오늘", "내일" or "10월 12일 (월)"; an item that lasts several days adds " → 10/15". */
    public static String when(CalendarData.Event event,LocalDate today){
        long diff=ChronoUnit.DAYS.between(today,event.start);
        String start;
        if(diff==0)start="오늘";
        else if(diff==1)start="내일";
        else if(diff<0)start="진행 중";
        else start=event.start.getMonthValue()+"월 "+event.start.getDayOfMonth()+"일 ("+weekday(event.start)+")";
        return event.end.isAfter(event.start)?start+" → "+shortDate(event.end):start;
    }

    /** Open items that touch today or come later, soonest first (what is already under way counts as today). */
    public static List<CalendarData.Event> upcoming(List<CalendarData.Event> events,LocalDate today,int limit){
        List<CalendarData.Event> out=new ArrayList<>();
        for(CalendarData.Event event:events)if(!event.completed&&!event.end.isBefore(today))out.add(event);
        out.sort(Comparator.comparing((CalendarData.Event e)->e.start.isBefore(today)?today:e.start)
            .thenComparing((CalendarData.Event e)->e.end).thenComparing((CalendarData.Event e)->e.title));
        return out.size()>limit?new ArrayList<>(out.subList(0,limit)):out;
    }

    /** What a screen reader says for the whole widget. */
    public static String describe(LocalDate today,List<CalendarData.Event> events){
        List<String> names=new ArrayList<>();
        int open=0;
        for(CalendarData.Event event:events){
            if(event.completed||event.start.isAfter(today)||event.end.isBefore(today))continue;
            open++;
            if(names.size()<5)names.add(event.title);
        }
        String head=today.getYear()+"년 "+today.getMonthValue()+"월 "+today.getDayOfMonth()+"일 "+weekday(today)+"요일, TEO 캘린더. ";
        String body=open==0?"오늘 남은 일정이 없어요. "
            :"오늘 일정 "+open+"개: "+String.join(", ",names)+(open>names.size()?" 외 "+(open-names.size())+"개. ":". ");
        return head+body+"탭하면 TEO 캘린더를 엽니다.";
    }
}

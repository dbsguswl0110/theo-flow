package com.theo.flow;

import android.graphics.*;
import android.text.TextPaint;
import android.text.TextUtils;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.List;

/**
 * A single raster frame: no nested RemoteViews, weight, repeated ID or runtime view inflation.
 * A narrow widget is the month; a wide one (a Fold opened up) adds an agenda of what is coming next.
 */
public final class CalendarPainter {
    static final int PAPER=Color.WHITE,INK=Color.rgb(50,40,32),MUTED=Color.rgb(110,88,70),FAINT=Color.rgb(143,128,115),
        LINE=Color.rgb(234,227,220),TODO=Color.rgb(200,105,61),TASK=Color.rgb(61,125,125),TODAY=Color.rgb(216,73,61),SUNDAY=Color.rgb(196,101,90);
    private static final String[] DAYS={"월","화","수","목","금","토","일"};

    /** The colour of a bar: the item's colour laid thinly over the paper, like the tinted bars of the app, the panel and the Mac widget. */
    static int tint(int color,float amount) {
        return Color.rgb(Math.round(Color.red(PAPER)*(1-amount)+Color.red(color)*amount),
            Math.round(Color.green(PAPER)*(1-amount)+Color.green(color)*amount),
            Math.round(Color.blue(PAPER)*(1-amount)+Color.blue(color)*amount));
    }

    public static Bitmap draw(int width,int height,LocalDate today,List<CalendarData.Event> events,boolean pending) {
        return draw(width,height,today,events,pending,2f);
    }
    public static Bitmap draw(int width,int height,LocalDate today,List<CalendarData.Event> events,boolean pending,float scale) {
        // One physical pixel per logical unit, doubled for sharp text. Cap total binder payload in provider.
        Bitmap bitmap=Bitmap.createBitmap(Math.max(1,Math.round(width*scale)),Math.max(1,Math.round(height*scale)),Bitmap.Config.ARGB_8888);
        Canvas c=new Canvas(bitmap);c.scale(scale,scale);
        Paint p=new Paint(Paint.ANTI_ALIAS_FLAG);
        p.setColor(PAPER);
        c.drawRoundRect(0,0,width,height,20,20,p);
        TextPaint text=new TextPaint(Paint.ANTI_ALIAS_FLAG);
        boolean wide=CalendarText.isWide(width,height);
        float monthRight=wide?Math.round(width*0.6f):width;
        drawMonth(c,p,text,monthRight,height,today,events,pending);
        if(wide)drawAgenda(c,p,text,monthRight,width,height,today,events);
        return bitmap;
    }

    private static void drawMonth(Canvas c,Paint p,TextPaint text,float outer,int height,LocalDate today,List<CalendarData.Event> events,boolean pending) {
        final float left=12,right=outer-12,top=70,bottom=height-10,col=(right-left)/7,row=(bottom-top)/6;
        text.setTypeface(Typeface.DEFAULT_BOLD);text.setColor(INK);text.setTextSize(20);
        c.drawText(today.getYear()+"년 "+today.getMonthValue()+"월",left,30,text);
        text.setTypeface(Typeface.DEFAULT);text.setTextSize(12);
        for(int i=0;i<7;i++){
            text.setColor(i==6?SUNDAY:MUTED);
            c.drawText(DAYS[i],left+col*(i+.5f)-text.measureText(DAYS[i])/2,58,text);
        }
        YearMonth month=YearMonth.from(today);LocalDate first=CalendarData.first(month);
        // One hairline between weeks; no vertical lines, so bars that span days are not cut into pieces.
        p.setColor(LINE);p.setAlpha(255);p.setStrokeWidth(.5f);
        for(int w=0;w<=6;w++)c.drawLine(left,top+w*row,right,top+w*row,p);
        Path capsule=new Path();
        for(int w=0;w<6;w++) {
            LocalDate week=first.plusDays(w*7);float y=top+w*row;
            text.setTextSize(12);
            for(int day=0;day<7;day++){
                LocalDate date=week.plusDays(day);
                boolean isToday=date.equals(today);
                text.setTypeface(isToday?Typeface.DEFAULT_BOLD:Typeface.DEFAULT);
                text.setColor(isToday?TODAY:date.getMonthValue()==today.getMonthValue()?INK:FAINT);
                String label=""+date.getDayOfMonth();
                c.drawText(label,left+col*(day+.5f)-text.measureText(label)/2,y+15,text);
            }
            text.setTypeface(Typeface.DEFAULT);
            int capacity=(int)((row-20)/16);
            // Under about 48 dp a row cannot hold a title and its "+n", so a small widget shows dots instead.
            if(row<48||capacity<1){drawDots(c,p,events,week,left,col,y,row);continue;}
            WeekLanes lanes=WeekLanes.layout(events,week,capacity);
            // A "+n" line needs room under the last bar, so a week that overflows gives one lane up for it.
            int roomy=(int)((row-30)/16);
            if(lanes.anyHidden()&&roomy>=1&&roomy<capacity)lanes=WeekLanes.layout(events,week,roomy);
            for(WeekLanes.Bar bar:lanes.bars){
                CalendarData.Event event=bar.event;
                float x1=left+bar.col*col+3,x2=left+(bar.col+bar.span)*col-3,ey=y+30+bar.lane*16;
                // Todo is orange and Task is teal, as on the web calendar and the macOS panel.
                int base=event.task?TASK:TODO;
                float tx,limit=x2-4;
                if(event.due){
                    // A tinted capsule behind the title. Where the item carries on into the next week (or came from the last)
                    // that end runs square to the edge of the week, so the bar reads as one piece.
                    boolean head=!event.start.isBefore(week),tail=!event.end.isAfter(week.plusDays(6));
                    float bx1=head?x1:left+bar.col*col,bx2=tail?x2:left+(bar.col+bar.span)*col,r=7;
                    p.setColor(tint(base,event.completed?.12f:.26f));p.setAlpha(255);
                    capsule.reset();
                    capsule.addRoundRect(bx1,ey-10.5f,bx2,ey+3.5f,new float[]{head?r:0,head?r:0,tail?r:0,tail?r:0,tail?r:0,tail?r:0,head?r:0,head?r:0},Path.Direction.CW);
                    c.drawPath(capsule,p);
                    tx=bx1+6;limit=bx2-5;
                } else {
                    // No due date: a dot and a title, no bar.
                    p.setColor(base);p.setAlpha(event.completed?110:255);
                    c.drawCircle(x1+3,ey-3.5f,2.4f,p);
                    tx=x1+9;
                }
                text.setTextSize(11.5f);text.setColor(INK);text.setAlpha(event.completed?120:255);
                String label=TextUtils.ellipsize(event.title,text,Math.max(1,limit-tx),TextUtils.TruncateAt.END).toString();
                c.save();c.clipRect(left,y+19,right,y+row-2);
                c.drawText(label,tx,ey,text);c.restore();
            }
            text.setAlpha(255);text.setTextSize(9.5f);text.setColor(MUTED);
            for(int day=0;day<7;day++)if(lanes.hidden[day]>0){
                String more="+"+lanes.hidden[day];
                c.drawText(more,left+(day+1)*col-3-text.measureText(more),y+row-4,text);
            }
        }
        if(pending) {
            text.setAlpha(255);text.setTextSize(11);text.setColor(MUTED);
            String message="동기화 대기";c.drawText(message,right-text.measureText(message),28,text);
        }
    }

    /** Too short a row for titles (a small widget): one dot per item under the day number instead. */
    private static void drawDots(Canvas c,Paint p,List<CalendarData.Event> events,LocalDate week,float left,float col,float y,float row) {
        float dotY=Math.min(y+25,y+row-5);
        for(int day=0;day<7;day++){
            LocalDate date=week.plusDays(day);
            int drawn=0;
            for(CalendarData.Event event:events){
                if(event.start.isAfter(date)||event.end.isBefore(date)||drawn>=3)continue;
                p.setColor(event.task?TASK:TODO);p.setAlpha(event.completed?110:255);
                c.drawCircle(left+col*(day+.5f)+(drawn-1)*6,dotY,2.2f,p);
                drawn++;
            }
        }
        p.setAlpha(255);
    }

    /** What is coming next, with the date in words: the part of the widget a Fold's big screen is for. */
    private static void drawAgenda(Canvas c,Paint p,TextPaint text,float x0,int width,int height,LocalDate today,List<CalendarData.Event> events) {
        final float left=x0+10,right=width-14,step=38;
        p.setColor(LINE);p.setAlpha(255);p.setStrokeWidth(.5f);
        c.drawLine(x0,18,x0,height-14,p);
        text.setAlpha(255);text.setTypeface(Typeface.DEFAULT_BOLD);text.setTextSize(15);text.setColor(INK);
        c.drawText("다가오는 일정",left+6,30,text);
        float y=58;
        int capacity=Math.max(1,(int)((height-14-y)/step));
        List<CalendarData.Event> all=CalendarText.upcoming(events,today,Integer.MAX_VALUE);
        if(all.isEmpty()){
            text.setTypeface(Typeface.DEFAULT);text.setTextSize(13);text.setColor(MUTED);
            c.drawText("예정된 일정이 없어요",left+6,y+14,text);
            return;
        }
        int shown=Math.min(all.size(),all.size()>capacity?capacity-1:capacity);
        shown=Math.max(1,shown);
        for(int i=0;i<shown;i++){
            CalendarData.Event event=all.get(i);
            p.setColor(event.task?TASK:TODO);p.setAlpha(255);
            c.drawCircle(left+10,y+9,4,p);
            float tx=left+22;
            text.setTypeface(Typeface.DEFAULT_BOLD);text.setTextSize(13.5f);text.setColor(INK);
            c.drawText(TextUtils.ellipsize(event.title,text,Math.max(1,right-tx),TextUtils.TruncateAt.END).toString(),tx,y+13,text);
            text.setTypeface(Typeface.DEFAULT);text.setTextSize(11.5f);text.setColor(MUTED);
            c.drawText(TextUtils.ellipsize(CalendarText.when(event,today),text,Math.max(1,right-tx),TextUtils.TruncateAt.END).toString(),tx,y+29,text);
            y+=step;
        }
        if(all.size()>shown){
            text.setTypeface(Typeface.DEFAULT);text.setTextSize(11.5f);text.setColor(MUTED);
            c.drawText("외 "+(all.size()-shown)+"개",left+22,y+13,text);
        }
    }
}

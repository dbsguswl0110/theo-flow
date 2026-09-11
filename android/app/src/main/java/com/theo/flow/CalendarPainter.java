package com.theo.flow;

import android.graphics.*;
import android.text.TextPaint;
import android.text.TextUtils;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.temporal.ChronoUnit;
import java.util.List;

/** A single raster frame: no nested RemoteViews, weight, repeated ID or runtime view inflation. */
public final class CalendarPainter {
    public static Bitmap draw(int width,int height,LocalDate today,List<CalendarData.Event> events,boolean pending) {
        return draw(width,height,today,events,pending,2f);
    }
    public static Bitmap draw(int width,int height,LocalDate today,List<CalendarData.Event> events,boolean pending,float scale) {
        // One physical pixel per logical unit, doubled for sharp text. Cap total binder payload in provider.
        Bitmap bitmap=Bitmap.createBitmap(Math.max(1,Math.round(width*scale)),Math.max(1,Math.round(height*scale)),Bitmap.Config.ARGB_8888);
        Canvas c=new Canvas(bitmap);c.scale(scale,scale);
        Paint p=new Paint(Paint.ANTI_ALIAS_FLAG);
        p.setColor(Color.rgb(253,249,243));
        c.drawRoundRect(0,0,width,height,20,20,p);
        final float left=12,right=width-12,top=66,bottom=height-10,col=(right-left)/7,row=(bottom-top)/6;
        TextPaint text=new TextPaint(Paint.ANTI_ALIAS_FLAG);text.setTypeface(Typeface.create("sans-serif",Typeface.NORMAL));
        text.setColor(Color.rgb(50,40,32));text.setTextSize(20);text.setTypeface(Typeface.DEFAULT_BOLD);
        c.drawText(today.getYear()+"년 "+today.getMonthValue()+"월",left,29,text);
        text.setTypeface(Typeface.DEFAULT);text.setTextSize(14);
        String[] headings={"M","T","W","T","F","S","S"};
        for(int i=0;i<7;i++)c.drawText(headings[i],left+col*(i+.5f)-text.measureText(headings[i])/2,54,text);
        YearMonth month=YearMonth.from(today);LocalDate first=CalendarData.first(month);
        // Delicate dividers are the calendar's boundaries, not extra blank panels.
        p.setColor(Color.rgb(229,218,207));p.setStrokeWidth(.5f);
        for(int w=0;w<=6;w++)c.drawLine(left,top+w*row,right,top+w*row,p);
        for(int d=1;d<7;d++)c.drawLine(left+d*col,top,left+d*col,bottom,p);
        for(int w=0;w<6;w++) {
            LocalDate week=first.plusDays(w*7);float y=top+w*row;
            text.setTextSize(10.5f);
            for(int day=0;day<7;day++){
                LocalDate date=week.plusDays(day);
                text.setColor(date.equals(today)?Color.rgb(220,35,45):
                    date.getMonthValue()==today.getMonthValue()?Color.BLACK:Color.rgb(161,150,142));
                String label=""+date.getDayOfMonth();
                c.drawText(label,left+col*(day+.5f)-text.measureText(label)/2,y+14,text);
            }
            List<CalendarData.Event> visible=CalendarData.week(events,week);
            int capacity=Math.max(1,(int)((row-18)/17));
            int shown=Math.min(visible.size(),capacity);
            for(int lane=0;lane<shown;lane++){
                CalendarData.Event event=visible.get(lane);
                int start=(int)Math.max(0,ChronoUnit.DAYS.between(week,event.start));
                int end=(int)Math.min(6,ChronoUnit.DAYS.between(week,event.end));
                float x1=left+start*col+3,x2=left+(end+1)*col-3,ey=y+29+lane*17;
                p.setColor(Color.rgb(153,104,71));p.setAlpha(event.completed?110:255);
                if(event.due){p.setStrokeWidth(1.2f);c.drawLine(x1,ey+4,x2,ey+4,p);}
                else c.drawCircle(x1+2,ey-4,2,p);
                text.setTextSize(11.5f);text.setColor(Color.rgb(55,42,33));text.setAlpha(event.completed?120:255);
                float tx=x1+(event.due?0:7);
                String label=TextUtils.ellipsize(event.title,text,Math.max(1,x2-tx),TextUtils.TruncateAt.END).toString();
                c.save();c.clipRect(x1,y+17,x2,y+row-9);
                c.drawText(label,tx,ey,text);c.restore();
            }
            if(visible.size()>shown){
                text.setAlpha(255);text.setTextSize(9);text.setColor(Color.rgb(119,90,68));
                String more="+"+(visible.size()-shown);
                c.drawText(more,right-text.measureText(more),y+14,text);
            }
        }
        if(pending) {
            text.setAlpha(255);text.setTextSize(9);text.setColor(Color.rgb(119,90,68));
            String message="동기화 대기";c.drawText(message,right-text.measureText(message),28,text);
        }
        return bitmap;
    }
}

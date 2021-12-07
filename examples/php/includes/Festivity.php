<?php
/** 
 *  Class Festivity
 *  similar to the class used in the LitCal API engine,
 *  except that this class converts a PHP Timestamp to a DateTime object
 *  and does not implement JsonSerializeable or the comparator function
 **/
class Festivity {

    public string $name;
    public DateTime $date;
    public string $color;
    public string $type;
    public int $grade;
    public string $displayGrade;
    public string $common;
    public string $liturgicalYear;

    function __construct( $name, $date, $color, $type, $grade = 0, $common = '', $liturgicalYear = '', $displayGrade = '' ) {
        $this->name     = (string) $name;
        $this->date     = DateTime::createFromFormat('U', $date, new DateTimeZone('UTC'));
        $this->color    = (string) $color;
        $this->type     = (string) $type;
        $this->grade    = (int) $grade;
        $this->common   = (string) $common;
        $this->liturgicalYear = (string) $liturgicalYear;
        $this->displayGrade = (string) $displayGrade;
    }
}

<?php

include_once( 'includes/LitCommon.php' );
include_once( 'includes/LitGrade.php' );

class FormControls {

    public static $settings = [
        "nameField"     => true,
        "dayField"      => true,
        "monthField"    => true,
        "colorField"    => true,
        "properField"   => true,
        "fromYearField" => true,
        "untilYearField"   => true
    ];

    private i18n $i18n;
    private LitCommon $LitCommon;
    private LitGrade $LitGrade;

    public function __construct( i18n $i18n )
    {
        $this->i18n = $i18n;
        $this->LitCommon = new LitCommon( $i18n->LOCALE );
        $this->LitGrade = new LitGrade( $i18n->LOCALE );
    }

    //public function $this->i18n->__construct()
    public function CreateFestivityRow($title=null){
        $uniqid = uniqid();
        $formRow = "";

        if($title !== null){
            $formRow .= "<h4>" . $title . "</h4>";
        }

        $formRow .= "<div class=\"row gx-2\">";

        if(self::$settings["nameField"]){
            $formRow .= "<div class=\"form-group col-sm-3\">" .
            "<label for=\"{$uniqid}Name\">" . _( "Name" ) . "</label><input type=\"text\" class=\"form-control litEvent litEventName\" id=\"{$uniqid}Name\" data-valuewas=\"\" />" .
            "<div class=\"invalid-feedback\">This same celebration was already defined elsewhere. Please remove it first where it is defined, then you can define it here.</div>" .
            "</div>";
        }

        if(self::$settings["dayField"]){
            $formRow .= "<div class=\"form-group col-sm-1\">" .
            "<label for=\"{$uniqid}Day\">" . _( "Day" ) . "</label><input type=\"number\" min=1 max=31 value=1 class=\"form-control litEvent litEventDay\" id=\"{$uniqid}Day\" />" .
            "</div>";
        }

        if(self::$settings["monthField"]){
            $formRow .= "<div class=\"form-group col-sm-2\">" .
            "<label for=\"{$uniqid}Month\"><span class=\"month-label\">" . _( "Month" ) . "</span><div class=\"form-check form-check-inline form-switch ms-2 ps-5 border border-end-0 border-secondary rounded-start bg-light\" title=\"switch on for mobile celebration as opposed to fixed date\">" .
            "<label class=\"form-check-label me-1\" for=\"{$uniqid}Strtotime\">Mobile</label>" .
            "<input class=\"form-check-input litEvent litEventStrtotimeSwitch\" type=\"checkbox\" data-bs-toggle=\"toggle\" data-bs-size=\"xs\" data-bs-onstyle=\"info\" data-bs-offstyle=\"dark\" role=\"switch\" id=\"{$uniqid}Strtotime\">" .
            "</div></label>" .
            "<select class=\"form-control litEvent litEventMonth\" id=\"{$uniqid}Month\">";
            $formatter = new IntlDateFormatter($this->i18n->LOCALE, IntlDateFormatter::FULL, IntlDateFormatter::NONE);
            $formatter->setPattern("MMMM");
            for($i=1;$i<=12;$i++){
                $month = DateTime::createFromFormat("n j",$i . " 15", new DateTimeZone('UTC') );
                $formRow .= "<option value={$i}>" . $formatter->format($month) . "</option>";
            }
    
            $formRow .= "</select>" .
            "</div>";
        }

        if(self::$settings["properField"]) {
            $commonsTemplate = $this->getCommonsTemplate();
            $properField = str_replace( ['{colWidth}','{uniqid}'], ['3',$uniqid], $commonsTemplate );
            $formRow .= $properField;
        }

        if(self::$settings["colorField"]){
            $formRow .= "<div class=\"form-group col-sm-1\">" .
            "<label for=\"{$uniqid}Color\">" . _( "Liturgical color" ) . "</label>" .
            "<select class=\"form-control litEvent litEventColor\" id=\"{$uniqid}Color\" multiple=\"multiple\" />" .
            "<option value=\"white\" selected>" . strtoupper(_( "white" ) ) . "</option>" .
            "<option value=\"red\">" . strtoupper(_( "red" ) ) . "</option>" .
            "<option value=\"purple\">" . strtoupper(_( "purple" ) ) . "</option>" .
            "<option value=\"green\">" . strtoupper(_( "green" ) ) . "</option>" .
            "</select>" .
            "</div>";
        }

        if(self::$settings["fromYearField"]){
            $formRow .= "<div class=\"form-group col-sm-1\">" .
            "<label for=\"{$uniqid}SinceYear\">" . _( "Since" ) . "</label>" .
            "<input type=\"number\" min=1970 max=9999 class=\"form-control litEvent litEventSinceYear\" id=\"{$uniqid}SinceYear\" value=1970 />" .
            "</div>";
        }

        if(self::$settings["untilYearField"]){
            $formRow .= "<div class=\"form-group col-sm-1\">" .
            "<label for=\"{$uniqid}UntilYear\">" . _( "Until" ) . "</label>" .
            "<input type=\"number\" min=1900 max=9999 class=\"form-control litEvent litEventUntilYear\" id=\"{$uniqid}UntilYear\" value=\"\" />" .
            "</div>";
        }

        $formRow .= "</div>";

        echo $formRow;
    }

    public function getCommonsTemplate() {
        return "<div class=\"form-group col-sm-{colWidth}\">" .
        "<label style=\"display:block;\" for=\"onTheFly{uniqid}Common\">" . _( "Common (or Proper)") . "</label>" .
        "<select class=\"form-control litEvent litEventCommon\" id=\"onTheFly{uniqid}Common\" multiple=\"multiple\" />" .
        "<option value=\"Proper\" selected>" . $this->LitCommon->C("Proper") . "</option>" .
        "<option value=\"Blessed Virgin Mary\">" . $this->LitCommon->C("Blessed Virgin Mary") . "</option>" .
        //"<optgroup label=\"" . $this->LitCommon->C("Common of Martyrs") . "\">" .
        "<option value=\"Martyrs\">" . $this->LitCommon->C("Martyrs") . "</option>" .
        "<option value=\"Martyrs:For One Martyr\">" . $this->LitCommon->C("Martyrs:For One Martyr") . "</option>" .
        "<option value=\"Martyrs:For Several Martyrs\">" . $this->LitCommon->C("Martyrs:For Several Martyrs") . "</option>" .
        "<option value=\"Martyrs:For Missionary Martyrs\">" . $this->LitCommon->C("Martyrs:For Missionary Martyrs") . "</option>" .
        "<option value=\"Martyrs:For One Missionary Martyr\">" . $this->LitCommon->C("Martyrs:For One Missionary Martyr") . "</option>" .
        "<option value=\"Martyrs:For Several Missionary Martyrs\">" . $this->LitCommon->C("Martyrs:For Several Missionary Martyrs") . "</option>" .
        "<option value=\"Martyrs:For a Virgin Martyr\">" . $this->LitCommon->C("Martyrs:For a Virgin Martyr") . "</option>" .
        "<option value=\"Martyrs:For a Holy Woman Martyr\">" . $this->LitCommon->C("Martyrs:For a Holy Woman Martyr") . "</option>" .
        //"<optgroup label=\"" . $this->LitCommon->C("Pastors") . "\">" .
        "<option value=\"Pastors\">" . $this->LitCommon->C("Pastors") . "</option>" .
        "<option value=\"Pastors:For a Pope\">" . $this->LitCommon->C("Pastors:For a Pope") . "</option>" .
        "<option value=\"Pastors:For a Bishop\">" . $this->LitCommon->C("Pastors:For a Bishop") . "</option>" .
        "<option value=\"Pastors:For One Pastor\">" . $this->LitCommon->C("Pastors:For One Pastor") . "</option>" .
        "<option value=\"Pastors:For Several Pastors\">" . $this->LitCommon->C("Pastors:For Several Pastors") . "</option>" .
        "<option value=\"Pastors:For Missionaries\">" . $this->LitCommon->C("Pastors:For Missionaries") . "</option>" .
        "<option value=\"Pastors:For Founders of a Church\">" . $this->LitCommon->C("Pastors:For Founders of a Church") . "</option>" .
        "<option value=\"Pastors:For Several Founders\">" . $this->LitCommon->C("Pastors:For Several Founders") . "</option>" .
        "<option value=\"Pastors:For One Founder\">" . $this->LitCommon->C("Pastors:For One Founder") . "</option>" .
        "<option value=\"Doctors\">" . $this->LitCommon->C("Doctors") . "</option>" .
        //"<optgroup label=\"" . $this->LitCommon->C("Virgins") . "\">" .
        "<option value=\"Virgins\">" . $this->LitCommon->C("Virgins") . "</option>" .
        "<option value=\"Virgins:For One Virgin\">" . $this->LitCommon->C("Virgins:For One Virgin") . "</option>" .
        "<option value=\"Virgins:For Several Virgins\">" . $this->LitCommon->C("Virgins:For Several Virgins") . "</option>" .
        //"<optgroup label=\"" . $this->LitCommon->C("Holy Men and Women") . "\">" .
        "<option value=\"Holy Men and Women\">" . $this->LitCommon->C("Holy Men and Women") . "</option>" .
        "<option value=\"Holy Men and Women:For One Saint\">" . $this->LitCommon->C("Holy Men and Women:For One Saint") . "</option>" .
        "<option value=\"Holy Men and Women:For Several Saints\">" . $this->LitCommon->C("Holy Men and Women:For Several Saints") . "</option>" .
        "<option value=\"Holy Men and Women:For Religious\">" . $this->LitCommon->C("Holy Men and Women:For Religious") . "</option>" .
        "<option value=\"Holy Men and Women:For an Abbot\">" . $this->LitCommon->C("Holy Men and Women:For an Abbot") . "</option>" .
        "<option value=\"Holy Men and Women:For a Monk\">" . $this->LitCommon->C("Holy Men and Women:For a Monk") . "</option>" .
        "<option value=\"Holy Men and Women:For a Nun\">" . $this->LitCommon->C("Holy Men and Women:For a Nun") . "</option>" .
        "<option value=\"Holy Men and Women:For Educators\">" . $this->LitCommon->C("Holy Men and Women:For Educators") . "</option>" .
        "<option value=\"Holy Men and Women:For Holy Women\">" . $this->LitCommon->C("Holy Men and Women:For Holy Women") . "</option>" .
        "<option value=\"Holy Men and Women:For Those Who Practiced Works of Mercy\">" . $this->LitCommon->C("Holy Men and Women:For Those Who Practiced Works of Mercy") . "</option>" .
        "<option value=\"Dedication of a Church\">" . $this->LitCommon->C("Dedication of a Church") . "</option>" .
        "</select>" .
        "</div>";
    }

    public function getGradeTemplate() {
        $gradeTemplate = "<div class=\"form-group col-sm-{colWidth}\">" .
        "<label style=\"display:block;\" for=\"onTheFly{uniqid}Grade\">" . _( "Grade") . "</label>" .
        "<select class=\"form-control litEvent litEventGrade\" id=\"onTheFly{uniqid}Grade\">";
        foreach( LitGrade::$values as $value ) {
            $gradeTemplate .= "<option value=\"$value\">" . $this->LitGrade->i18n( $value ) . "</option>";
        }
        $gradeTemplate .= "</select>";
        $gradeTemplate .= "</div>";
        return $gradeTemplate;
    }

    public static function setOption($option,$value){
        if(isset(self::$settings[$option]) ){
            if(gettype($value) === 'boolean' ){
                self::$settings[$option] = $value;
            }
        }
    }

    public static function setOptions($options){
        foreach($options as $option => $value){
            if(isset(self::$settings[$option]) ){
                if(gettype($value) === 'boolean' ){
                    self::$settings[$option] = $value;
                }
            }
        }
    }

}

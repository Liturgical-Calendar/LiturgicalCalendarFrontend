</div>
<!-- /.container-fluid -->

</main>
<!-- End of Main Content -->

<!-- Footer -->
<footer class="sticky-footer bg-white">
    <div class="container my-auto">
        <div class="copyright text-center my-auto">
            <span>Copyright &copy; John D'Orazio 2020</span>
        </div>
    </div>
</footer>
<!-- End of Footer -->

</div>
<!-- End of Content Wrapper -->

</div>
<!-- End of Page Wrapper -->

<!-- jQuery-->
<script src="https://cdnjs.cloudflare.com/ajax/libs/jquery/3.6.0/jquery.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/jquery-easing/1.4.1/jquery.easing.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/js-cookie/2.2.1/js.cookie.min.js"></script>

<!-- Bootstrap / sb-admin JavaScript-->
<script src="https://cdnjs.cloudflare.com/ajax/libs/bootstrap/5.2.3/js/bootstrap.bundle.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/startbootstrap-sb-admin@7.0.5/dist/js/scripts.js"></script>

<!-- i18next -->
<script src="https://cdnjs.cloudflare.com/ajax/libs/i18next/21.6.6/i18next.min.js" integrity="sha512-3CUvxyR4WtlZanN/KmorrZ2VALnUndAQBYjf1HEYNa6McBY+G2zYq4gOZPUDkDtuk3uBdQIva0Lk89hYQ9fQrA==" crossorigin="anonymous" referrerpolicy="no-referrer"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/jquery-i18next/1.2.1/jquery-i18next.min.js" integrity="sha512-79RgNpOyaf8AvNEUdanuk1x6g53UPoB6Fh2uogMkOMGADBG6B0DCzxc+dDktXkVPg2rlxGvPeAFKoZxTycVooQ==" crossorigin="anonymous" referrerpolicy="no-referrer"></script>
<script src="https://cdn.jsdelivr.net/npm/i18next-http-backend@1.3.1/i18nextHttpBackend.min.js"></script>

<!-- Custom scripts for all pages-->
<script src="assets/js/i18n.js"></script>
<script src="assets/js/common.js"></script>

<?php 
    //some assets are only needed on certain pages
    $pageName = basename( $_SERVER["SCRIPT_FILENAME"], '.php' );
    if( $pageName === "index" ){
        echo '<script src="assets/js/homepage.js"></script>';
    }
    if( $pageName === "extending" || $pageName === "admin" ) {
        echo '<script src="https://cdnjs.cloudflare.com/ajax/libs/bootstrap-multiselect/1.1.2/js/bootstrap-multiselect.min.js"></script>';
        echo '<script src="https://cdnjs.cloudflare.com/ajax/libs/toastr.js/latest/toastr.min.js"></script>';
    }
    if( file_exists( "assets/js/{$pageName}.js" ) ) {
        echo "<script type=\"module\" src=\"assets/js/{$pageName}.js\"></script>";
    }

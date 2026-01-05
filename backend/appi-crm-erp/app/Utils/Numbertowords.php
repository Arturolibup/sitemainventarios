<?php

namespace App\Utils;

class NumberToWords
{
    /**
     * Convierte un monto a texto en español para MXN.
     * 5236.25 -> "cinco mil doscientos treinta y seis pesos con veinticinco centavos"
     * Maneja "de pesos" tras millón/millones/billón/billones/mil millones.
     */
    public static function toCurrencyEs($amount): string
    {
        // Normaliza la entrada
        if (is_string($amount)) {
            $amount = str_replace(['$', ',', ' '], '', $amount);
        }
        $amount = (float) $amount;

        // Trabajar en centavos (evita errores de coma flotante)
        $centTotal = (int) round($amount * 100);
        $enteros   = intdiv($centTotal, 100);
        $centavos  = $centTotal % 100;

        // Texto enteros/centavos
        $textoEnteros  = self::numeroALetras($enteros);
        $textoCentavos = self::numeroALetras($centavos);

        // Apócope (uno/veintiuno -> un/veintiún) al final y antes de sustantivos
        $textoEnterosApo  = self::apocope($textoEnteros);
        $textoCentavosApo = self::apocope($textoCentavos);

        // Singular/plural
        $lblPesos    = ($enteros === 1) ? 'peso'    : 'pesos';
        $lblCentavos = ($centavos === 1) ? 'centavo' : 'centavos';

        // "de pesos" si termina en millón/millones/billón/billones/mil millones
        $requiereDe = (bool) preg_match('/(millón|millones|billón|billones|mil millones)$/u', $textoEnterosApo);
        $de = $requiereDe ? ' de' : '';

        $frase = trim("$textoEnterosApo$de $lblPesos con $centavos $lblCentavos");
        return mb_strtolower($frase, 'UTF-8');
    }

    /**
     * Convierte 0..billones a letras (minúsculas, sin moneda)
     */
    public static function numeroALetras(int $num): string
    {
        if ($num === 0) return 'cero';

        $partes = [];

        $billones = intdiv($num, 1000000000000);
        $num     %= 1000000000000;

        $milMillones = intdiv($num, 1000000000);   // "mil millones"
        $num        %= 1000000000;

        $millones = intdiv($num, 1000000);
        $num     %= 1000000;

        $miles = intdiv($num, 1000);
        $resto = $num % 1000;

        if ($billones > 0) {
            $partes[] = ($billones === 1)
                ? 'un billón'
                : self::convertirCentenas($billones) . ' billones';
        }

        if ($milMillones > 0) {
            $partes[] = ($milMillones === 1)
                ? 'mil millones'
                : self::convertirCentenas($milMillones) . ' mil millones';
        }

        if ($millones > 0) {
            $partes[] = ($millones === 1)
                ? 'un millón'
                : self::convertirCentenas($millones) . ' millones';
        }

        if ($miles > 0) {
            $partes[] = ($miles === 1)
                ? 'mil'
                : self::convertirCentenas($miles) . ' mil';
        }

        if ($resto > 0) {
            $partes[] = self::convertirCentenas($resto);
        }

        return trim(preg_replace('/\s+/', ' ', implode(' ', $partes)));
    }

    /**
     * 1..999 a letras (minúsculas)
     */
    private static function convertirCentenas(int $n): string
{
    $UNIDADES = [
        '', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve',
        'diez', 'once', 'doce', 'trece', 'catorce', 'quince',
        'dieciséis', 'diecisiete', 'dieciocho', 'diecinueve', 'veinte',
        'veintiuno', 'veintidós', 'veintitrés', 'veinticuatro', 'veinticinco',
        'veintiséis', 'veintisiete', 'veintiocho', 'veintinueve'
    ];
    $DECENAS = ['', 'diez', 'veinte', 'treinta', 'cuarenta', 'cincuenta', 'sesenta', 'setenta', 'ochenta', 'noventa'];
    $CENTENAS = [
        '', 'ciento', 'doscientos', 'trescientos', 'cuatrocientos',
        'quinientos', 'seiscientos', 'setecientos', 'ochocientos', 'novecientos'
    ];

    if ($n === 0) return '';
    if ($n === 100) return 'cien';
    if ($n < 30) return $UNIDADES[$n];

    $c = intdiv($n, 100);
    $r = $n % 100;

    $texto = '';
    if ($c > 0) {
        $texto .= $CENTENAS[$c];
        if ($r > 0) $texto .= ' ';
    }

    if ($r > 0) {
        if ($r < 30) {
            $texto .= $UNIDADES[$r];
        } else {
            $d = intdiv($r, 10);
            $u = $r % 10;
            $texto .= $DECENAS[$d];
            if ($u > 0) {
                $texto .= ' y ' . $UNIDADES[$u];
            }
        }
    }
    return trim($texto);
}

    /**
     * Apócope para sustantivo masculino:
     * "uno/veintiuno/y uno" -> "un/veintiún/y un"
     * y también antes de "mil/millones/billones".
     */
    private static function apocope(string $texto): string
    {
        // Al final de la cadena
        $texto = preg_replace('/\buno$/u', 'un', $texto);
        $texto = preg_replace('/\bveintiuno$/u', 'veintiún', $texto);
        $texto = preg_replace('/y uno$/u', 'y un', $texto);

        // Antes de "mil/millones/billones"
        $texto = preg_replace('/\buno(?=\s+(mil|millones|billones)\b)/u', 'un', $texto);
        $texto = preg_replace('/\bveintiuno(?=\s+(mil|millones|billones)\b)/u', 'veintiún', $texto);

        return $texto;
    }
}
